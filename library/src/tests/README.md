# Test Templates

This folder contains test-generated CloudFormation templates that act as example documentation for possible stack configurations produced by this library.

These files are not golden snapshots used for strict assertions. They are reference outputs to help reviewers understand stack shape and configuration patterns.

## Template docs

- Baseline with custom Lambda props: [`template-with-custom-props.json`](./template-with-custom-props.json)
- Existing authorizer ARN configuration: [`template-with-existing-authorizer.json`](./template-with-existing-authorizer.json)
- Header authorizer configuration: [`template-with-custom-header-authorizer.json`](./template-with-custom-header-authorizer.json)
- Deploy options passthrough (stage variables): [`template-with-deploy-options.json`](./template-with-deploy-options.json)

## How they are generated

- `library/src/tests/library/api-stack.test.ts`
- `library/src/tests/unit/deployOptions.test.ts`

Template output is normalized via `library/src/tests/helpers/templateOutput.ts` to reduce noisy diffs from date/time values.
