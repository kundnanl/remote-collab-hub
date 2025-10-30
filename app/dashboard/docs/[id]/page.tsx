import DocumentEditorLayout from "./DocumentEditorLayout";

export default async function Page({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const { id } = await params;
  
  return <DocumentEditorLayout docId={id} />;
}