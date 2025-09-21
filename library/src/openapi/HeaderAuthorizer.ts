import { APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent, APIGatewayRequestAuthorizerEventHeaders } from 'aws-lambda'
import { HeaderAuthorizerProps } from './RestAPI'
import { AuthorizerContext } from './AWSCognitoAuthorizer'

const {
  REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON,
  REQUIRED_HEADERS_REGEX_VALUES_JSON,
  DISALLOWED_HEADERS_JSON,
  DISALLOWED_HEADER_REGEXES_JSON
} = process.env

const headerAuthorizerSettings: HeaderAuthorizerProps = {
  requiredHeadersWithAllowedValues: REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON !== undefined ? JSON.parse(REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON) : undefined,
  requiredHeadersRegexValues: REQUIRED_HEADERS_REGEX_VALUES_JSON !== undefined ? JSON.parse(REQUIRED_HEADERS_REGEX_VALUES_JSON) : {},
  disallowedHeaders: DISALLOWED_HEADERS_JSON !== undefined ? JSON.parse(DISALLOWED_HEADERS_JSON) : undefined,
  disallowedHeaderRegexes: DISALLOWED_HEADER_REGEXES_JSON !== undefined ? JSON.parse(DISALLOWED_HEADER_REGEXES_JSON) : undefined
}

export async function handler (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> {
  const availableHeaders = event?.headers ?? {}
  console.log('Authorizing using Available Headers')
  return await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
}

async function checkHeadersForPolicyMatch (availableHeaders: APIGatewayRequestAuthorizerEventHeaders, headerAuthorizerSettings: HeaderAuthorizerProps): Promise<APIGatewayAuthorizerResult> {
  const policies: APIGatewayAuthorizerResult[] = []

  if (headerAuthorizerSettings.requiredHeadersWithAllowedValues !== undefined) {
    console.log('Checking requiredHeadersWithAllowedValues')
    const requiredHeadersWithAllowedValues = headerAuthorizerSettings.requiredHeadersWithAllowedValues
    let allMatch = true
    for (const header in requiredHeadersWithAllowedValues) {
      const allowedValues = requiredHeadersWithAllowedValues[header]
      const headerValue = availableHeaders[header] ?? availableHeaders[header.toLowerCase()] ?? ''
      if (!allowedValues.includes(headerValue)) {
        allMatch = false
        console.log(`Header ${header} with value ${headerValue} does not match allowed values`, { allowedValues })
        break
      }
    }
    if (allMatch) {
      console.log('All requiredHeadersWithAllowedValues matched')
      policies.push(buildPolicy('Allow', 'required-headers-with-allowed-values', { method: 'requiredHeadersWithAllowedValues' }))
    } else {
      policies.push(buildPolicy('Deny', 'required-headers-with-allowed-values', { authorizerError: 'Required headers with allowed values did not match' }))
    }
  }

  if (headerAuthorizerSettings.requiredHeadersRegexValues !== undefined) {
    console.log('Checking requiredHeadersRegexValues')
    const requiredHeadersRegexValues = headerAuthorizerSettings.requiredHeadersRegexValues
    let allMatch = true
    for (const header in requiredHeadersRegexValues) {
      const regexString = requiredHeadersRegexValues[header]
      const regex = new RegExp(regexString)
      const headerValue = availableHeaders[header] ?? availableHeaders[header.toLowerCase()] ?? ''
      if (!regex.test(headerValue)) {
        allMatch = false
        console.log(`Header ${header} with value ${headerValue} does not match regex`, { regex: regexString })
        break
      }
    }
    if (allMatch) {
      console.log('All requiredHeadersRegexValues matched')
      policies.push(buildPolicy('Allow', 'required-headers-regex-values', { method: 'requiredHeadersRegexValues' }))
    } else {
      policies.push(buildPolicy('Deny', 'required-headers-regex-values', { authorizerError: 'Required headers regex values did not match' }))
    }
  }

  if (headerAuthorizerSettings.disallowedHeaders !== undefined) {
    console.log('Checking disallowedHeaders')
    const disallowedHeaders = headerAuthorizerSettings.disallowedHeaders
    let anyMatch = false
    for (const header of disallowedHeaders) {
      const headerValue = availableHeaders[header] ?? availableHeaders[header.toLowerCase()] ?? ''
      if (headerValue !== '') {
        anyMatch = true
        console.log(`Disallowed header ${header} is present with value`, { headerValue })
        break
      }
    }
    if (anyMatch) {
      policies.push(buildPolicy('Deny', 'disallowed-headers', { authorizerError: 'Disallowed headers were present' }))
    } else {
      console.log('No disallowedHeaders were present')
      policies.push(buildPolicy('Allow', 'disallowed-headers', { method: 'disallowedHeaders' }))
    }
  }

  if (headerAuthorizerSettings.disallowedHeaderRegexes !== undefined) {
    console.log('Checking disallowedHeaderRegexes')
    const disallowedHeaderRegexes = headerAuthorizerSettings.disallowedHeaderRegexes
    let anyMatch = false
    disallowedHeaderRegexes.forEach((regexString) => {
      const regex = new RegExp(regexString)
      for (const header in availableHeaders) {
        const headerValue = availableHeaders[header] ?? availableHeaders[header.toLowerCase()] ?? ''
        if (regex.test(headerValue)) {
          anyMatch = true
          console.log(`Header ${header} with value ${headerValue} matches disallowed regex`, { regex: regexString })
          break
        }
      }
    })
    if (anyMatch) {
      policies.push(buildPolicy('Deny', 'disallowed-header-regexes', { authorizerError: 'Disallowed header regexes matched' }))
    } else {
      console.log('No disallowedHeaderRegexes matched')
      policies.push(buildPolicy('Allow', 'disallowed-header-regexes', { method: 'disallowedHeaderRegexes' }))
    }
  }

  // Return the first Allow policy if any, otherwise return the first Deny policy or a default Deny
  const validPolicy = policies.find(policy => policy.policyDocument.Statement[0].Effect === 'Allow')
  if (validPolicy !== undefined) {
    return validPolicy
  }
  return policies[0] ?? buildPolicy('Deny', 'no-verifiers-configured', { authorizerError: 'No verifiers configured' })
}

function buildPolicy (allowOrDeny: 'Allow' | 'Deny', principalId: string, context: AuthorizerContext): APIGatewayAuthorizerResult {
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
