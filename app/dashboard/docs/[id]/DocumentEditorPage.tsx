'use client';

import '@/app/styles/editor.css';
import '@/app/dashboard/docs/editor/extensions/mentionStyles.css';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import type { Content } from '@tiptap/core';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';

import CustomTableCell from '@/app/dashboard/docs/editor/extensions/CustomTableCell';
import TableBubbleMenu from '@/components/editor/TableBubbleMenu';
import LinkModal from '@/components/LinkModal';

import { trpc } from '@/server/client';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import suggestion from '@/app/dashboard/docs/editor/extensions/suggestion';

import { useRoom, useSelf } from '@liveblocks/react/suspense';
import { getYjsProviderForRoom } from '@liveblocks/yjs';

type Props = { docId: string };

export default function DocumentEditorPage({ docId }: Props) {
  const router = useRouter();
  const room = useRoom();

  const yProvider = useMemo(() => getYjsProviderForRoom(room), [room]);
  const ydoc = yProvider.getYDoc();

  const me = useSelf((s) => s.info) as
    | { name?: string; color?: string; picture?: string }
    | undefined;

  type DocumentData = {
    id: string;
    title: string;
    content: Content | null;
    canEdit: boolean;
  };

  const { data: rawData, isLoading, error } =
    trpc.docs.getDocumentById.useQuery({ id: docId });
  const data = rawData as DocumentData | undefined;

  const saveMutation = trpc.docs.updateContent.useMutation();

  const [isLinkModalOpen, setLinkModalOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ history: false }),
        Underline,
        TextStyle,
        Color,
        Highlight.configure({ multicolor: true }),
        Typography,
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
          provider: yProvider,
          user: {
            name: me?.name ?? 'Anonymous',
            color: me?.color ?? '#aaa',
            avatar: me?.picture,
          },
        }),
      ],
      autofocus: true,
      editable: Boolean(data?.canEdit),
      editorProps: {
        handleClick(view, pos, event) {
          const attrs = view.state.doc.nodeAt(pos)?.marks?.find(m => m.type.name === 'link')?.attrs;
          if (attrs?.href && (event.metaKey || event.ctrlKey)) {
            window.open(attrs.href, '_blank');
            return true;
          }
          return false;
        },
        attributes: {
          class: 'prose prose-lg max-w-none w-full min-h-[400px] focus:outline-none',
        },
      },
      immediatelyRender: false,
    },
    [data?.canEdit, yProvider, ydoc, me?.name, me?.color, me?.picture]
  );

  // Keep editability in sync
  useEffect(() => {
    if (editor && typeof data?.canEdit === 'boolean') {
      editor.setEditable(data.canEdit);
    }
  }, [editor, data?.canEdit]);

  // Seed initial content once (when the shared doc is empty)
  useEffect(() => {
    if (!editor || !data?.content) return;
    const fragment = ydoc.getXmlFragment('prosemirror'); // default used by Tiptap collab
    const isEmpty = fragment.length === 0;
    if (isEmpty) {
      editor.commands.setContent(data.content as Content);
    }
  }, [editor, data?.content, ydoc]);

  const handleManualSave = async () => {
    if (!editor || !data?.canEdit) return;
    try {
      await saveMutation.mutateAsync({ id: docId, content: editor.getJSON() });
    } catch (err) {
      console.error('Manual save failed:', err);
    }
  };

  // Rendering guards
  if (!mounted || isLoading || !editor) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
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
    );
  }

  const toolbarButtons = [
    { cmd: 'bold', icon: Bold, action: () => editor.chain().focus().toggleBold().run() },
    { cmd: 'italic', icon: Italic, action: () => editor.chain().focus().toggleItalic().run() },
    { cmd: 'underline', icon: UnderlineIcon, action: () => editor.chain().focus().toggleUnderline().run() },
    { cmd: 'blockquote', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { cmd: 'codeBlock', icon: Code2, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { cmd: 'bulletList', icon: List, action: () => editor.chain().focus().toggleBulletList().run() },
    { cmd: 'orderedList', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run() },
  ] as const;

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{data.title}</h1>
        <Button variant="outline" size="sm" onClick={handleManualSave} disabled={!data.canEdit}>
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
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-gray-200' : ''}
        >
          <Heading size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          className={editor.isActive('highlight') ? 'bg-gray-200' : ''}
        >
          <LucideHighlight size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            const { from, to } = editor.state.selection;
            const currentText = editor.state.doc.cut(from, to).textContent;
            setSelectedText(currentText);
            setLinkModalOpen(true);
          }}
          className={editor.isActive('link') ? 'bg-gray-200' : ''}
        >
          <LinkIcon size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()}
        >
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
          editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          if (text) editor?.commands.insertContent(text);
        }}
        defaultText={selectedText}
      />
    </div>
  );
}
