// Deliberately plumbing only, in the same spirit as IndexedDbSnapshotStore.
// Everything with a decision in it - what goes in the file, what it is called,
// when the button is live - lives in GameFile and Toolbar, where it is tested.
// jsdom implements neither createObjectURL nor a download, so there is nothing
// here a test could hold on to.
export function downloadJson(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
