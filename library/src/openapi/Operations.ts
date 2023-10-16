export function generateOperationId (restSignature: string): string {
  const method = restSignature.split(' ')[0].toUpperCase()
  const path = restSignature.split(' ')[1]

  const cleanedPath = path
    .replace(/-/g, '/') // Replace any hypens with slashes
    .replace(/\/+/g, '/') // Replace any repeating sequences of slashes with a single slash
    .replace(/[^a-zA-Z0-9/]/g, '') // Remove any non-alphanumeric characters apart from slashes

  let operationId = ''
  const pathComponents = cleanedPath.split('/')
  const capitalizedParts = pathComponents.map((component) => {
    return component.charAt(0).toUpperCase() + component.slice(1)
  })

  const findDuplicateWords = /([A-z]+)\1/g
  operationId = capitalizedParts.join('').replace(findDuplicateWords, '$1')

  return method.toLowerCase() + operationId
}
