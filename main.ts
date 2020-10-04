import {config, EventParser, ParsedEvent} from "./config"

import * as CloudWatchLogs from "aws-sdk/clients/cloudwatchlogs"
import axios from "axios"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const logs = new CloudWatchLogs()
const elasticsearch = axios.create({ baseURL: "http://localhost:9200/" })
const kibana = axios.create({ baseURL: "http://localhost:5601/api" })

async function main(): Promise<void> {
  try {
    await createKibanaIndexPattern("logs", {
      title: "logs-*",
      timeFieldName: "@timestamp"
    })

    for (const {logGroupName, eventParser} of config.logGroups) {
      await indexLogGroup(logGroupName, eventParser)
    }
  } catch (err) {
    console.error("ERROR")
    if (err.response) {
      console.error(JSON.stringify(err.response.data, null, 2))
    } else {
      console.error(err)
    }
  }
}

async function indexLogGroup<T extends ParsedEvent>(logGroupName: string, parseEvent: EventParser<T>): Promise<void> {
  await ensureIndexExists(`logs-${logGroupName}`)

  const streams = await logs.describeLogStreams({ logGroupName }).promise()
  for (const s of streams.logStreams ?? []) {
    const from = Date.now() - (2 * DAY)
    await fetchAndIndexLogEvents(logGroupName, s.logStreamName!, from, parseEvent)
  }
}

type KibanaPatternConfig = {
  title: string
  timeFieldName: string
}

async function createKibanaIndexPattern(id: string, config: KibanaPatternConfig): Promise<void> {
  await kibana.request({
    method: "POST",
    url: `/saved_objects/index-pattern/${id}?overwrite=true`,
    data: JSON.stringify({ attributes: config }),
    headers: {
      "Content-Type": "application/json",
      "kbn-xsrf": "true"
    }
  })
}

async function fetchAndIndexLogEvents<T extends ParsedEvent>(logGroupName: string, logStreamName: string, startTime: number, parseEvent: EventParser<T>, nextToken?: string): Promise<void> {
    const logEventsResponse = await logs.getLogEvents({
      logGroupName,
      logStreamName,
      startTime,
      nextToken,
      startFromHead: true,
    }).promise()

    const events = logEventsResponse.events ?? []
    console.log(`Received ${events.length} events from CloudWatch`)

    if (events.length > 0) {
      await indexEvents(`logs-${logGroupName}`, logGroupName, logStreamName, events, parseEvent)
    }

    if (logEventsResponse.nextForwardToken !== nextToken) {
      await fetchAndIndexLogEvents(logGroupName, logStreamName, startTime, parseEvent, logEventsResponse.nextForwardToken)
    }
}

async function indexEvents<T extends ParsedEvent>(indexName: string, logGroupName: string, logStreamName: string, events: CloudWatchLogs.OutputLogEvents, parseEvent: EventParser<T>): Promise<void> {
  const commands = events.map(e => {
    const command = JSON.stringify({ index: { _index: indexName, _type: "_doc" } })
    const content = JSON.stringify({
      ...e,
      "@loggroup": logGroupName,
      "@logstream": logStreamName,
      ...parseEvent(e),
    })
    return command + "\n" + content + "\n"
  })
  await sendBulk(commands)
}

async function sendBulk(commands: string[]): Promise<void> {
  await elasticsearch.request({
    method: "POST",
    url: `/_bulk`,
    data: Buffer.from(commands.join("")),
    headers: {
      "Content-Type": "application/x-ndjson"
    }
  })
}

async function ensureIndexExists(name: string): Promise<void> {
  try {
    const response = await elasticsearch.request({
      method: `DELETE`,
      url: `/${name}`,
    })
    console.log(response.data)
  } catch (err) {
    console.error(err.response.data)
  }
  try {
    const response = await elasticsearch.request({
      method: `PUT`,
      url: `/${name}`,
    })
    console.log(response.data)
  } catch (err) {
    const { data } = err.response
    if (data.error.type !== 'resource_already_exists_exception') {
      console.error(data)
      throw err
    }
  }
}

main()
