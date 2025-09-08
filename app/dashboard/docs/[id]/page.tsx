'use client'

import '@/app/styles/editor.css'
import '@/app/dashboard/docs/editor/extensions/mentionStyles.css'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextStyle from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import BulletList from '@tiptap/extension-bullet-list'
import OrderedList from '@tiptap/extension-ordered-list'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'

import CustomTableCell from '@/app/dashboard/docs/editor/extensions/CustomTableCell'
import TableBubbleMenu from '@/components/editor/TableBubbleMenu'
import LinkModal from '@/components/LinkModal'

import { trpc } from '@/server/client'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Redo,
  Undo,
  Heading,
  Quote,
  Code2,
  Save,
  List,
  ListOrdered,
  Table as TableIcon,
  Highlighter as LucideHighlight,
  Link as LinkIcon,
} from 'lucide-react'

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { useUser } from '@clerk/nextjs'
import suggestion from '@/app/dashboard/docs/editor/extensions/suggestion'

export default function DocumentEditorPage() {
  const router = useRouter()
  const params = useParams()
  const docId = params.id as string
  const { user } = useUser()
  const [mounted, setMounted] = useState(false)
  const { data, isLoading, error } = trpc.docs.getDocumentById.useQuery({ id: docId })
  const saveMutation = trpc.docs.updateContent.useMutation()

  const [isLinkModalOpen, setLinkModalOpen] = useState(false)
  const [selectedText, setSelectedText] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  const ydoc = useMemo(() => new Y.Doc(), [])
  const provider = useMemo(() => new WebsocketProvider('ws://localhost:1234', docId, ydoc), [docId, ydoc])

  const COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#a855f7', '#6366f1', '#22c55e', '#f43f5e']
  function getRandomColor(name: string) {
    let hash = 0
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
    return COLORS[Math.abs(hash) % COLORS.length]
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Typography,
      HorizontalRule,
      BulletList,
      OrderedList,
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      CustomTableCell,
      Placeholder.configure({ placeholder: 'Start writing your document...' }),
      Mention.configure({ HTMLAttributes: { class: 'mention' }, suggestion }),
      Link.configure({
        autolink: true,
        openOnClick: false,
        linkOnPaste: true,
        HTMLAttributes: {
          class: 'text-blue-600 underline cursor-pointer hover:opacity-80',
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user?.firstName || 'Anonymous',
          color: getRandomColor(user?.firstName || 'Anonymous'),
        },
      }),
    ],
    autofocus: true,
    editorProps: {
      handleClick(view, pos, event) {
        const attrs = view.state.doc.nodeAt(pos)?.marks?.find(m => m.type.name === 'link')?.attrs
        if (attrs?.href && (event.metaKey || event.ctrlKey)) {
          window.open(attrs.href, '_blank')
          return true
        }
        return false
      },
      attributes: {
        class: 'prose prose-lg max-w-none w-full min-h-[400px] focus:outline-none',
      },
    },
  })

  const handleManualSave = async () => {
    if (!editor || !data?.canEdit) return
    try {
      await saveMutation.mutateAsync({ id: docId, content: editor.getJSON() })
    } catch (err) {
      console.error('Manual save failed:', err)
    }
  }

  if (!mounted || isLoading || !editor) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="h-screen flex items-center justify-center text-center px-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">Unable to load document</h2>
          <p className="text-sm text-muted-foreground mb-4">
            You may not have access or the document doesn’t exist.
          </p>
          <Button onClick={() => router.push('/dashboard/docs')}>Go Back</Button>
        </div>
      </div>
    )
  }

  type CommandConfig = {
    cmd: string
    icon: React.ComponentType<{ size?: number }>
    action: () => void
  }

  const toolbarButtons: CommandConfig[] = [
    { cmd: 'bold', icon: Bold, action: () => editor.chain().focus().toggleBold().run() },
    { cmd: 'italic', icon: Italic, action: () => editor.chain().focus().toggleItalic().run() },
    { cmd: 'underline', icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run() },
    { cmd: 'blockquote', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { cmd: 'codeBlock', icon: Code2, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { cmd: 'bulletList', icon: List, action: () => editor.chain().focus().toggleBulletList().run() },
    { cmd: 'orderedList', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run() },
  ]


  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <Button variant="outline" size="sm" onClick={handleManualSave}>
          <span className="flex items-center gap-1 text-sm">
            <Save size={16} />
            Save
          </span>
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 border p-2 rounded-md bg-gray-50">
        {toolbarButtons.map(({ cmd, icon: Icon, action }) => (
          <Button
            key={cmd}
            variant="ghost"
            onClick={action}
            className={editor.isActive(cmd) ? 'bg-gray-200' : ''}
          >
            <Icon size={16} />
          </Button>
        ))}
        <Button variant="ghost" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}>
          <Heading size={16} />
        </Button>
        <Button variant="ghost" onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()} className={editor.isActive('highlight') ? 'bg-gray-200' : ''}>
          <LucideHighlight size={16} />
        </Button>
        <Button variant="ghost" onClick={() => {
          const currentText = editor.state.doc.cut(editor.state.selection.from, editor.state.selection.to).textContent
          setSelectedText(currentText)
          setLinkModalOpen(true)
        }} className={editor.isActive('link') ? 'bg-gray-200' : ''}>
          <LinkIcon size={16} />
        </Button>
        <Button variant="ghost" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}>
          <TableIcon size={16} />
        </Button>
        <Button variant="ghost" onClick={() => editor.chain().focus().undo().run()}>
          <Undo size={16} />
        </Button>
        <Button variant="ghost" onClick={() => editor.chain().focus().redo().run()}>
          <Redo size={16} />
        </Button>
      </div>

      {/* Editor */}
      <div className="border rounded-xl shadow bg-white px-6 py-4">
        <EditorContent editor={editor} className="tiptap" />
        {editor && <TableBubbleMenu editor={editor} />}
      </div>

      {/* Link modal */}
      <LinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSubmit={(url, text) => {
          editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
          if (text) {
            editor?.commands.insertContent(text)
          }
        }}
        defaultText={selectedText}
      />
    </div>
  )
}
