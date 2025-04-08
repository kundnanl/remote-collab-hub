'use client'

import { BubbleMenu } from '@tiptap/react'
import { Editor } from '@tiptap/react'
import {
  Trash2,
  Rows3,
  Columns3,
  Merge,
  Split,
  Eraser,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  editor: Editor
}

export default function TableBubbleMenu({ editor }: Props) {
  if (!editor) return null

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({  }) => {
        return editor.isActive('table')
      }}
      tippyOptions={{ duration: 150 }}
      className="bg-white text-black shadow-md border border-gray-200 p-2 rounded-lg flex gap-2 z-[100]"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        <Rows3 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        <Columns3 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().mergeCells().run()}
      >
        <Merge size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().splitCell().run()}
      >
        <Split size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 size={16} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => editor.chain().focus().setCellAttribute('backgroundColor', null).run()}
      >
        <Eraser size={16} />
      </Button>
    </BubbleMenu>
  )
}
