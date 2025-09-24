import { expect, describe, it, jest } from '@jest/globals'
import { checkHeadersForPolicyMatch } from '../../openapi/HeaderAuthorizer'

describe('Authorization Logging', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.log>

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it('should log a single authorization summary instead of multiple console.log calls', async () => {
    const headerAuthorizerSettings = {
      requiredHeadersWithAllowedValues: {
        'x-api-key': ['1234567890', '0987654321'],
        'x-client-id': ['client-1', 'client-2']
      },
      disallowedHeaders: ['x-forbidden']
    }

    const availableHeaders = {
      'x-api-key': '1234567890',
      'x-client-id': 'client-2',
      'x-custom': 'value'
    }

    const result = await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)

    // Should only log once for the authorization summary
    expect(consoleSpy).toHaveBeenCalledTimes(1)

    // The single log should be an Authorization Summary
    const logCall = consoleSpy.mock.calls[0]
    expect(logCall[0]).toBe('Authorization Summary:')

    // Parse the JSON summary
    const summary = JSON.parse(logCall[1])

    // Verify summary structure
    expect(summary).toHaveProperty('suppliedHeaders')
    expect(summary).toHaveProperty('criteriaResults')
    expect(summary).toHaveProperty('finalDecision')
    expect(summary).toHaveProperty('principalId')
    expect(summary).toHaveProperty('reason')
    expect(summary).toHaveProperty('timestamp')

    // Verify supplied headers are captured
    expect(summary.suppliedHeaders).toEqual({
      'x-api-key': '1234567890',
      'x-client-id': 'client-2',
      'x-custom': 'value'
    })

    // Verify criteria results are present
    expect(summary.criteriaResults).toHaveLength(2)
    expect(summary.criteriaResults[0].checkType).toBe('requiredHeadersWithAllowedValues')
    expect(summary.criteriaResults[0].result).toBe('pass')
    expect(summary.criteriaResults[1].checkType).toBe('disallowedHeaders')
    expect(summary.criteriaResults[1].result).toBe('pass')

    // Verify final decision
    expect(summary.finalDecision).toBe('Allow')
    expect(result.policyDocument.Statement[0].Effect).toBe('Allow')
  })

  it('should provide detailed failure information in the summary', async () => {
    const headerAuthorizerSettings = {
      requiredHeadersWithAllowedValues: {
        'x-api-key': ['valid-key']
      },
      requiredHeadersRegexValues: {
        'x-session-id': '^session-[0-9]{6}$'
      }
    }

    const availableHeaders = {
      'x-api-key': 'invalid-key',
      'x-session-id': 'bad-session-123456'
    }

    await checkHeadersForPolicyMatch(availableHeaders, headerAuthorizerSettings)

    const logCall = consoleSpy.mock.calls[0]
    const summary = JSON.parse(logCall[1])

    // Should have failed criteria
    expect(summary.finalDecision).toBe('Deny')
    expect(summary.criteriaResults[0].result).toBe('fail')

    // Should have detailed failure information
    expect(summary.criteriaResults[0].failedHeaders).toHaveProperty('x-api-key')
    expect(summary.criteriaResults[0].failedHeaders['x-api-key']).toEqual({
      expected: ['valid-key'],
      actual: 'invalid-key'
    })
  })
})
