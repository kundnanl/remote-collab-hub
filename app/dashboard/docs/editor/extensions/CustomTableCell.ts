import TableCell from '@tiptap/extension-table-cell'

const CustomTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: el => el.getAttribute('data-bg') || null,
        renderHTML: attrs => ({
          'data-bg': attrs.backgroundColor,
        }),
      },
    }
  },
})

export default CustomTableCell
