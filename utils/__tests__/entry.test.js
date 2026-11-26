
function appendPortal(str) {
  return `${str} portal`;
}

test('appends " portal" to the end of the passed argument', () => {
  expect(appendPortal('test')).toBe('test portal');
});
