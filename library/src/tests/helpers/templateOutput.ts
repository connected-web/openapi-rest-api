import { writeFileSync } from 'fs'

const ISO_TIMESTAMP_REGEX = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g
const DATE_REGEX = /\b\d{4}-\d{2}-\d{2}\b/g

function normalizeTemplateOutput (value: string): string {
  return value
    .replace(ISO_TIMESTAMP_REGEX, '<ISO_TIMESTAMP>')
    .replace(DATE_REGEX, '<DATE>')
}

export function writeNormalizedTemplate (outputPath: string, template: unknown): void {
  const templateJson = JSON.stringify(template, null, 2)
  writeFileSync(outputPath, normalizeTemplateOutput(templateJson))
}
