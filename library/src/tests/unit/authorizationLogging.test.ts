import { expect } from 'chai'
import { describe, it, beforeEach, afterEach } from 'mocha'
import sinon from 'sinon'
import { checkHeadersForPolicyMatch } from '../../openapi/HeaderAuthorizer'

describe('Authorization Logging', () => {
  let consoleSpy: sinon.SinonSpy

  beforeEach(() => {
    consoleSpy = sinon.spy(console, 'log')
  })

  afterEach(() => {
    consoleSpy.restore()
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
    expect(consoleSpy.callCount).to.equal(1)

    // The single log should be an Authorization Summary
    const logCall = consoleSpy.getCall(0)
    expect(logCall.args[0]).to.equal('Authorization Summary:')

    // Parse the JSON summary
    const summary = JSON.parse(logCall.args[1])

    // Verify summary structure
    expect(summary).to.have.property('suppliedHeaders')
    expect(summary).to.have.property('criteriaResults')
    expect(summary).to.have.property('finalDecision')
    expect(summary).to.have.property('principalId')
    expect(summary).to.have.property('reason')
    expect(summary).to.have.property('timestamp')

    // Verify supplied headers are captured
    expect(summary.suppliedHeaders).to.deep.equal({
      'x-api-key': '1234567890',
      'x-client-id': 'client-2',
      'x-custom': 'value'
    })

    // Verify criteria results are present
    expect(summary.criteriaResults).to.have.lengthOf(2)
    expect(summary.criteriaResults[0].checkType).to.equal('requiredHeadersWithAllowedValues')
    expect(summary.criteriaResults[0].result).to.equal('pass')
    expect(summary.criteriaResults[1].checkType).to.equal('disallowedHeaders')
    expect(summary.criteriaResults[1].result).to.equal('pass')

    // Verify final decision
    expect(summary.finalDecision).to.equal('Allow')
    expect(result.policyDocument.Statement[0].Effect).to.equal('Allow')
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

    const logCall = consoleSpy.getCall(0)
    const summary = JSON.parse(logCall.args[1])

    // Should have failed criteria
    expect(summary.finalDecision).to.equal('Deny')
    expect(summary.criteriaResults[0].result).to.equal('fail')

    // Should have detailed failure information
    expect(summary.criteriaResults[0].failedHeaders).to.have.property('x-api-key')
    expect(summary.criteriaResults[0].failedHeaders['x-api-key']).to.deep.equal({
      expected: ['valid-key'],
      actual: 'invalid-key'
    })
  })
})
