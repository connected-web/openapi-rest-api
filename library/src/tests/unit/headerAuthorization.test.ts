import { expect } from 'chai'
import { describe, it } from 'vitest'
import { checkHeadersForPolicyMatch } from '../../openapi/HeaderAuthorizer'

describe('Header Authorizer', () => {
  describe('REQUIRED_HEADERS_WITH_ALLOWED_VALUES_JSON', () => {
    const headerAuthorizerSettings = {
      requiredHeadersWithAllowedValues: {
        'x-api-key': ['1234567890', '0987654321'],
        'x-client-id': ['client-1', 'client-2']
      }
    }

    it('Allows when all required headers with allowed values match', async () => {
      const availableHeaders = {
        'x-api-key': '1234567890',
        'x-client-id': 'client-2'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })

    it('Denies when a required header is missing', async () => {
      const availableHeaders = {
        'x-api-key': '1234567890'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })

    it('Denies when a required header value does not match allowed values', async () => {
      const availableHeaders = {
        'x-api-key': 'invalid-key',
        'x-client-id': 'client-1'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })

    it('Allows when required headers are provided with capitalized names', async () => {
      const availableHeaders = {
        'X-Api-Key': '1234567890', // Capitalized header
        'X-Client-Id': 'client-2' // Capitalized header
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })
  })

  describe('REQUIRED_HEADERS_REGEX_VALUES_JSON', () => {
    const headerAuthorizerSettings = {
      requiredHeadersRegexValues: {
        'x-request-id': '^[a-f0-9]{32}$',
        'x-trace-id': '^trace-[a-z0-9]{8}$'
      }
    }

    it('Allows when all required headers match regex patterns', async () => {
      const availableHeaders = {
        'x-request-id': 'a1b2c3d4e5f60718293a0b1c2d3e4f50',
        'x-trace-id': 'trace-abcdefgh'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })

    it('Denies when a required header is missing', async () => {
      const availableHeaders = {
        'x-request-id': 'a1b2c3d4e5f60718293a0b1c2d3e4f50'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })

    it('Denies when a required header value does not match regex pattern', async () => {
      const availableHeaders = {
        'x-request-id': 'invalid-request-id',
        'x-trace-id': 'trace-abcdefgh'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })

    it('Allows when required headers match regex patterns with capitalized names', async () => {
      const availableHeaders = {
        'X-Request-Id': 'a1b2c3d4e5f60718293a0b1c2d3e4f50', // Capitalized header
        'X-Trace-Id': 'trace-abcdefgh' // Capitalized header
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })
  })

  describe('DISALLOWED_HEADERS', () => {
    const headerAuthorizerSettings = {
      disallowedHeaders: ['x-disallowed-header', 'x-another-bad-header']
    }

    it('Allows when no disallowed headers are present', async () => {
      const availableHeaders = {
        'x-api-key': 'some-key',
        'x-client-id': 'client-1'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })

    it('Denies when a disallowed header is present', async () => {
      const availableHeaders = {
        'x-api-key': 'some-key',
        'x-disallowed-header': 'bad-value'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })
  })

  describe('DISALLOWED_HEADER_REGEXES', () => {
    const headerAuthorizerSettings = {
      disallowedHeaderRegexes: ['^x-regex-.*$', '^x-bad-.*$']
    }

    it('Allows when no headers match disallowed regex patterns', async () => {
      const availableHeaders = {
        'x-api-key': 'some-key',
        'x-client-id': 'client-1'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
    })

    it('Denies when a header matches a disallowed regex pattern', async () => {
      const availableHeaders = {
        'x-regex-header': 'some-value',
        'x-bad-header': 'another-value'
      }
      const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
      expect(result.policyDocument.Statement[0].Effect).to.equal('Deny')
    })
  })

  it('Combines multiple checks correctly', async () => {
    const headerAuthorizerSettings = {
      requiredHeadersWithAllowedValues: {
        'x-api-key': ['1234567890']
      },
      requiredHeadersRegexValues: {
        'x-request-id': '^[a-f0-9]{32}$'
      },
      disallowedHeaders: ['x-disallowed-header'],
      disallowedHeaderRegexes: ['^x-regex-.*$']
    }

    const availableHeaders: Record<string, string> = {
      'x-api-key': '1234567890',
      'x-request-id': 'a1b2c3d4e5f60718293a0b1c2d3e4f50'
    }
    const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
    expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')

    // Now add a disallowed header to trigger Deny
    availableHeaders['x-disallowed-header'] = 'bad-value'
    const resultWithDisallowed = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)
    expect(resultWithDisallowed.policyDocument.Statement[0].Effect).to.equal('Deny')
  })
})
