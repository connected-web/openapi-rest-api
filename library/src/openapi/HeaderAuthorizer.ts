import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent, APIGatewayRequestAuthorizerEventHeaders } from 'aws-lambda'
import { OpenAPIHeaderAuthorizerProps } from './RestAPI'
import { OpenAPIAuthorizerContext } from './AWSCognitoAuthorizer'

// Authorization logging interfaces
interface AuthorizationLogEvent {
  type: 'header-check' | 'regex-check' | 'disallowed-check' | 'policy-decision'
  checkType: string
  header?: string
  expected?: string | string[]
  actual?: string
  result: 'pass' | 'fail'
  message: string
}

interface HeaderCriteriaResult {
  checkType: string
  result: 'pass' | 'fail'
  details: string
  matchedHeaders?: Record<string, string>
  failedHeaders?: Record<string, { expected: string | string[], actual: string }>
}

interface AuthorizationSummary {
  suppliedHeaders: Record<string, string>
  criteriaResults: HeaderCriteriaResult[]
  finalDecision: 'Allow' | 'Deny'
  principalId: string
  reason: string
  timestamp: string
}

// Authorization logger class
class AuthorizationLogger {
  private readonly events: AuthorizationLogEvent[] = []
  private readonly suppliedHeaders: Record<string, string> = {}

  constructor (headers: APIGatewayRequestAuthorizerEventHeaders) {
    // Convert headers to lowercase for consistent handling
    this.suppliedHeaders = toLowerKeys(headers)
  }

  logHeaderCheck (checkType: string, header: string, expected: string | string[], actual: string, result: 'pass' | 'fail'): void {
    this.events.push({
      type: 'header-check',
      checkType,
      header,
      expected,
      actual,
      result,
      message: `Header '${header}': expected ${JSON.stringify(expected)}, got '${actual}' - ${result}`
    })
  }

  logRegexCheck (checkType: string, header: string, pattern: string, actual: string, result: 'pass' | 'fail'): void {
    this.events.push({
      type: 'regex-check',
      checkType,
      header,
      expected: pattern,
      actual,
      result,
      message: `Header '${header}': pattern /${pattern}/ ${result === 'pass' ? 'matched' : 'did not match'} '${actual}'`
    })
  }

  logDisallowedCheck (checkType: string, header: string, result: 'pass' | 'fail', reason?: string): void {
    this.events.push({
      type: 'disallowed-check',
      checkType,
      header,
      result,
      message: reason ?? `Header '${header}' disallowed check: ${result}`
    })
  }

  logPolicyDecision (result: 'pass' | 'fail', reason: string): void {
    this.events.push({
      type: 'policy-decision',
      checkType: 'final-decision',
      result,
      message: reason
    })
  }

  generateSummary (finalDecision: 'Allow' | 'Deny', principalId: string, reason: string): AuthorizationSummary {
    const criteriaResults: HeaderCriteriaResult[] = []

    // Group events by check type
    const eventsByCheckType = this.events.reduce<Record<string, AuthorizationLogEvent[]>>((acc, event) => {
      const key = event.checkType
      if (acc[key] === undefined) acc[key] = []
      acc[key].push(event)
      return acc
    }, {})

    // Create criteria results for each check type
    for (const [checkType, events] of Object.entries(eventsByCheckType)) {
      if (checkType === 'final-decision') continue

      const failedEvents = events.filter(e => e.result === 'fail')
      const passedEvents = events.filter(e => e.result === 'pass')

      const matchedHeaders: Record<string, string> = {}
      const failedHeaders: Record<string, { expected: string | string[], actual: string }> = {}

      passedEvents.forEach(event => {
        if (event.header != null && event.header !== '' && event.actual !== undefined) {
          matchedHeaders[event.header] = event.actual
        }
      })

      failedEvents.forEach(event => {
        if (event.header != null && event.header !== '' && event.expected !== undefined && event.actual !== undefined) {
          failedHeaders[event.header] = {
            expected: event.expected,
            actual: event.actual
          }
        }
      })

      criteriaResults.push({
        checkType,
        result: failedEvents.length > 0 ? 'fail' : 'pass',
        details: failedEvents.length > 0
          ? `${failedEvents.length} check(s) failed: ${failedEvents.map(e => e.message).join('; ')}`
          : `All ${passedEvents.length} check(s) passed`,
        matchedHeaders: Object.keys(matchedHeaders).length > 0 ? matchedHeaders : undefined,
        failedHeaders: Object.keys(failedHeaders).length > 0 ? failedHeaders : undefined
      })
    }

    return {
      suppliedHeaders: this.suppliedHeaders,
      criteriaResults,
      finalDecision,
      principalId,
      reason,
      timestamp: new Date().toISOString()
    }
  }

  logSummary (summary: AuthorizationSummary): void {
    console.log('Authorization Summary:', JSON.stringify(summary, null, 2))
  }
}

const {
  REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON,
  REQUIRED_HEADERS_REGEX_VALUES_JSON,
  DISALLOWED_HEADERS_JSON,
  DISALLOWED_HEADER_REGEXES_JSON
} = process.env

function toLowerKeys<T extends Record<string, any>> (obj: T): Record<string, any> {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]))
}

const headerAuthorizerSettings: OpenAPIHeaderAuthorizerProps = {
  requiredHeadersWithAllowedValues: REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON !== undefined
    ? toLowerKeys(JSON.parse(REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON))
    : undefined,
  requiredHeadersRegexValues: REQUIRED_HEADERS_REGEX_VALUES_JSON !== undefined
    ? toLowerKeys(JSON.parse(REQUIRED_HEADERS_REGEX_VALUES_JSON))
    : {},
  disallowedHeaders: DISALLOWED_HEADERS_JSON !== undefined
    ? (JSON.parse(DISALLOWED_HEADERS_JSON) as string[]).map(h => h.toLowerCase())
    : undefined,
  disallowedHeaderRegexes: DISALLOWED_HEADER_REGEXES_JSON !== undefined
    ? JSON.parse(DISALLOWED_HEADER_REGEXES_JSON)
    : undefined
}

export async function handler (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  const availableHeaders = event?.headers ?? {}
  return await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
}

export async function checkHeadersForPolicyMatch (availableHeaders: APIGatewayRequestAuthorizerEventHeaders, headerAuthorizerSettings: OpenAPIHeaderAuthorizerProps): Promise<APIGatewayAuthorizerResult> {
  const logger = new AuthorizationLogger(availableHeaders)
  const normalizedHeaders = toLowerKeys(availableHeaders)
  const policies: APIGatewayAuthorizerResult[] = []

  if (headerAuthorizerSettings.requiredHeadersWithAllowedValues !== undefined) {
    const requiredHeadersWithAllowedValues = headerAuthorizerSettings.requiredHeadersWithAllowedValues
    let allMatch = true
    for (const header in requiredHeadersWithAllowedValues) {
      const allowedValues = requiredHeadersWithAllowedValues[header]
      const headerValue = normalizedHeaders[header] ?? ''
      if (!allowedValues.includes(headerValue)) {
        allMatch = false
        logger.logHeaderCheck('requiredHeadersWithAllowedValues', header, allowedValues, headerValue, 'fail')
        break
      } else {
        logger.logHeaderCheck('requiredHeadersWithAllowedValues', header, allowedValues, headerValue, 'pass')
      }
    }
    if (allMatch) {
      policies.push(buildPolicy('Allow', 'required-headers-with-allowed-values', { method: 'requiredHeadersWithAllowedValues' }))
    } else {
      policies.push(buildPolicy('Deny', 'required-headers-with-allowed-values', { authorizerError: 'Required headers with allowed values did not match' }))
    }
  }

  if (headerAuthorizerSettings.requiredHeadersRegexValues !== undefined) {
    const requiredHeadersRegexValues = headerAuthorizerSettings.requiredHeadersRegexValues
    let allMatch = true
    for (const header in requiredHeadersRegexValues) {
      const regexString = requiredHeadersRegexValues[header]
      const regex = new RegExp(regexString)
      const headerValue = normalizedHeaders[header] ?? ''
      if (!regex.test(headerValue)) {
        allMatch = false
        logger.logRegexCheck('requiredHeadersRegexValues', header, regexString, headerValue, 'fail')
        break
      } else {
        logger.logRegexCheck('requiredHeadersRegexValues', header, regexString, headerValue, 'pass')
      }
    }
    if (allMatch) {
      policies.push(buildPolicy('Allow', 'required-headers-regex-values', { method: 'requiredHeadersRegexValues' }))
    } else {
      policies.push(buildPolicy('Deny', 'required-headers-regex-values', { authorizerError: 'Required headers regex values did not match' }))
    }
  }

  if (headerAuthorizerSettings.disallowedHeaders !== undefined) {
    const disallowedHeaders = headerAuthorizerSettings.disallowedHeaders
    let anyMatch = false
    for (const header of disallowedHeaders) {
      const headerValue = normalizedHeaders[header] ?? ''
      if (headerValue !== '') {
        anyMatch = true
        logger.logDisallowedCheck('disallowedHeaders', header, 'fail', `Disallowed header '${header}' is present with value '${String(headerValue)}'`)
        break
      } else {
        logger.logDisallowedCheck('disallowedHeaders', header, 'pass', `Disallowed header '${header}' is not present`)
      }
    }
    if (anyMatch) {
      policies.push(buildPolicy('Deny', 'disallowed-headers', { authorizerError: 'Disallowed headers were present' }))
    } else {
      policies.push(buildPolicy('Allow', 'disallowed-headers', { method: 'disallowedHeaders' }))
    }
  }

  if (headerAuthorizerSettings.disallowedHeaderRegexes !== undefined) {
    const disallowedHeaderRegexes = headerAuthorizerSettings.disallowedHeaderRegexes
    let anyMatch = false
    disallowedHeaderRegexes.forEach((regexString) => {
      const regex = new RegExp(regexString)
      for (const header in normalizedHeaders) {
        if (regex.test(header)) {
          anyMatch = true
          logger.logDisallowedCheck('disallowedHeaderRegexes', header, 'fail', `Header '${header}' matches disallowed regex /${String(regexString)}/`)
          break
        }
      }
    })
    if (anyMatch) {
      policies.push(buildPolicy('Deny', 'disallowed-header-regexes', { authorizerError: 'Disallowed header regexes matched' }))
    } else {
      // Log successful checks for headers that didn't match any disallowed regex
      Object.keys(normalizedHeaders).forEach(header => {
        logger.logDisallowedCheck('disallowedHeaderRegexes', header, 'pass', `Header '${header}' does not match any disallowed regex patterns`)
      })
      policies.push(buildPolicy('Allow', 'disallowed-header-regexes', { method: 'disallowedHeaderRegexes' }))
    }
  }

  // Determine final policy and generate summary
  let finalPolicy: APIGatewayAuthorizerResult
  let finalDecision: 'Allow' | 'Deny'
  let reason: string

  // Prefer Deny if present
  const denyPolicy = policies.find(policy => policy.policyDocument.Statement[0].Effect === 'Deny')
  if (denyPolicy != null) {
    finalPolicy = denyPolicy
    finalDecision = 'Deny'
    reason = denyPolicy.context?.authorizerError !== undefined ? String(denyPolicy.context.authorizerError) : 'Access denied by policy'
    logger.logPolicyDecision('fail', reason)
  } else {
    const allowPolicy = policies.find(policy => policy.policyDocument.Statement[0].Effect === 'Allow')
    if (allowPolicy != null) {
      finalPolicy = allowPolicy
      finalDecision = 'Allow'
      reason = 'Access granted - all criteria passed'
      logger.logPolicyDecision('pass', reason)
    } else {
      finalPolicy = buildPolicy('Deny', 'no-verifiers-configured', { authorizerError: 'No verifiers configured' })
      finalDecision = 'Deny'
      reason = 'No verifiers configured'
      logger.logPolicyDecision('fail', reason)
    }
  }

  // Generate and log the summary
  const summary = logger.generateSummary(finalDecision, finalPolicy.principalId, reason)
  logger.logSummary(summary)

  return finalPolicy
}

function buildPolicy (allowOrDeny: 'Allow' | 'Deny', principalId: string, context: OpenAPIAuthorizerContext): APIGatewayAuthorizerResult {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Effect: allowOrDeny,
        Action: 'execute-api:invoke',
        Resource: 'arn:aws:execute-api:*:*:*'
      }]
    },
    context
  }
}
