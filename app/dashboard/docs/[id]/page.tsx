"use client";

import "@/app/styles/editor.css";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import CustomTableCell from "@/app/dashboard/docs/editor/extensions/CustomTableCell";
import TableBubbleMenu from "@/components/editor/TableBubbleMenu";

import { trpc } from "@/server/client";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import { useUser } from "@clerk/nextjs";

export default function DocumentEditorPage() {
  const router = useRouter();
  const params = useParams();
  const docId = params.id as string;
  const { user } = useUser();

  const [mounted, setMounted] = useState(false);
  const { data, isLoading, error } = trpc.docs.getDocumentById.useQuery({
    id: docId,
  });
  const saveMutation = trpc.docs.updateContent.useMutation();

  useEffect(() => {
    setMounted(true);
  }, []);

  const ydoc = useMemo(() => new Y.Doc(), []);
  const provider = useMemo(
    () => new WebsocketProvider("ws://localhost:1234", docId, ydoc),
    [docId, ydoc]
  );

  const COLORS = [
    "#ef4444", "#f97316", "#eab308", "#10b981",
    "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6",
    "#a855f7", "#6366f1", "#22c55e", "#f43f5e",
  ];
  
  function getRandomColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return COLORS[Math.abs(hash) % COLORS.length];
  }
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ history: false }),
      Underline,
      Placeholder.configure({
        placeholder: "Start writing your document...",
      }),
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

      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user?.firstName || "Anonymous",
          color: getRandomColor(user?.firstName || "Anonymous"),
        },
      }),
    ],
    autofocus: true,
    editorProps: {
      attributes: {
        class:
          "prose prose-lg max-w-none w-full min-h-[400px] focus:outline-none",
      },
    },
  });

  const handleManualSave = async () => {
    if (!editor || !data?.canEdit) return;
    try {
      await saveMutation.mutateAsync({
        id: docId,
        content: editor.getJSON(),
      });
    } catch (err) {
      console.error("Manual save failed:", err);
    }
  };

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
          <Button onClick={() => router.push("/dashboard/docs")}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

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
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive("bold") ? "bg-gray-200" : ""}
        >
          <Bold size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive("italic") ? "bg-gray-200" : ""}
        >
          <Italic size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive("underline") ? "bg-gray-200" : ""}
        >
          <UnderlineIcon size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()
          }
          className={editor.isActive("highlight") ? "bg-gray-200" : ""}
        >
          <LucideHighlight size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={
            editor.isActive("heading", { level: 2 }) ? "bg-gray-200" : ""
          }
        >
          <Heading size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive("blockquote") ? "bg-gray-200" : ""}
        >
          <Quote size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive("codeBlock") ? "bg-gray-200" : ""}
        >
          <Code2 size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive("bulletList") ? "bg-gray-200" : ""}
        >
          <List size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive("orderedList") ? "bg-gray-200" : ""}
        >
          <ListOrdered size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3 }).run()
          }
        >
          <TableIcon size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo size={16} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo size={16} />
        </Button>
      </div>

      {/* Editor */}
      <div className="border rounded-xl shadow bg-white px-6 py-4">
        <div className="relative">
          <EditorContent editor={editor} className="tiptap"/>
          {editor && <TableBubbleMenu editor={editor} />}
        </div>
      </div>
    </div>
  );
}
