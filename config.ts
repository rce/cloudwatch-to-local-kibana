import * as AWS from "aws-sdk"
import * as CloudWatchLogs from "aws-sdk/clients/cloudwatchlogs"

export type ParsedEvent = {
  "@timestamp": Date
}

export type EventParser<T extends ParsedEvent> = (e: CloudWatchLogs.OutputLogEvent) => T

AWS.config.update({
  region: "eu-west-1",
  credentials: new AWS.SharedIniFileCredentials({
    profile: "discord-prod"
  })
})

const logGroups = [
  {
    logGroupName: `discord-prod-bot`,
    eventParser: (e: CloudWatchLogs.OutputLogEvent) => {
      // Log events look like this:
      // 2020-10-04 07:56:05,703 INFO FEED Checking feeds
      const [date, time, level, module, ...rest] = (e.message || "").split(" ")
      return {
        "@timestamp": new Date(e.timestamp!),
        date, time, level, module,
        message: rest.join(" ")
      }
    }
  }
]
export const config = {
  logGroups,
}
