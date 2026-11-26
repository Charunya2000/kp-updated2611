
export default function updateArray(items, updatedItem) {
  return items.map(item => {
    if (item.id === updatedItem.id) {
      return updatedItem;
    } else {
      return item;
    }
  });
};
