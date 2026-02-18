import { writeFileSync } from 'fs'

const DEPLOYMENT_TIME_REGEX = /\\"deploymentTime\\":\\"[^\\"]*\\"/g

function normalizeTemplateOutput (value: string): string {
  return value.replace(DEPLOYMENT_TIME_REGEX, '\\"deploymentTime\\":\\"<DEPLOYMENT_TIME>\\"')
}

export function writeNormalizedTemplate (outputPath: string, template: unknown): void {
  const templateJson = JSON.stringify(template, null, 2)
  writeFileSync(outputPath, normalizeTemplateOutput(templateJson))
}
