import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FileText, Loader2, Plus, UploadCloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export function ManualsManagement() {
    const { toast } = useToast();
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [title, setTitle] = useState("");
    const [segment, setSegment] = useState("Plantas Daninhas");
    const [file, setFile] = useState<File | null>(null);

    const { data: manuals, isLoading } = useQuery<any[]>({
        queryKey: ["/api/farm/webhook/n8n/manuals"],
        queryFn: async () => {
            // We can use the public n8n endpoint just to list them
            const res = await apiRequest("GET", "/api/farm/webhook/n8n/manuals");
            const data = await res.json();
            return data.manuals || [];
        }
    });

    const uploadMutation = useMutation({
        mutationFn: async () => {
            if (!file || !title || !segment) {
                throw new Error("Preencha todos os campos e anexe o PDF");
            }

            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", title);
            formData.append("segment", segment);

            const res = await fetch("/api/admin/manuals", {
                method: "POST",
                body: formData, // FormData sends multipart/form-data
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Falha ao enviar arquivo");
            }

            return await res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/farm/webhook/n8n/manuals"] });
            toast({
                title: "Manual Processado!",
                description: "O documento foi lido pela IA Gemini e o texto já está no banco de dados.",
            });
            setIsUploadOpen(false);
            setTitle("");
            setFile(null);
            setUploading(false);
        },
        onError: (error: Error) => {
            setUploading(false);
            toast({
                title: "Erro ao upar apostila",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    const handleUpload = () => {
        setUploading(true);
        uploadMutation.mutate();
    };

    return (
        <Card className="shadow-lg border-0 ring-1 ring-gray-200">
            <CardHeader className="flex flex-row items-center justify-between border-b bg-gray-50/50 pb-6">
                <div>
                    <CardTitle className="text-xl text-gray-800 flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-600" />
                        Base de Conhecimento RAG
                    </CardTitle>
                    <CardDescription className="text-gray-500 mt-1">
                        Faça upload de apostilas, bulas e manuais em PDF. O texto será extraído e disponibilizado para a IA responder às dúvidas dos usuários no WhatsApp.
                    </CardDescription>
                </div>
                <Button onClick={() => setIsUploadOpen(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Apostila / PDF
                </Button>
            </CardHeader>

            <CardContent className="p-0">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-gray-50/50">
                            <TableRow>
                                <TableHead className="py-4">Título do Documento</TableHead>
                                <TableHead>Segmento</TableHead>
                                <TableHead>Data de Inclusão</TableHead>
                                <TableHead>Status da Indexação (Texto)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {manuals?.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                        Nenhum manual encontrado. Suba um PDF para treinar a IA.
                                    </TableCell>
                                </TableRow>
                            )}
                            {manuals?.map((manual: any) => (
                                <TableRow key={manual.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium text-gray-900 border-l-2 border-transparent hover:border-blue-500">
                                        {manual.title}
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {manual.segment}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-gray-500">
                                        {new Date(manual.createdAt).toLocaleDateString("pt-BR")}
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                            Extraído ({manual.contentText?.length || 0} caracteres)
                                        </span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            {/* Upload Modal */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UploadCloud className="h-5 w-5 text-blue-600" />
                            Enviar Novo Manual / PDF
                        </DialogTitle>
                        <DialogDescription>
                            O arquivo PDF será lido pelo Gemini e convertido em texto para a IA do WhatsApp. Isso pode levar alguns segundos.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="title">Título do Conteúdo</Label>
                            <Input
                                id="title"
                                placeholder="Ex: Manual de Identificação de Plantas Daninhas"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="segment">Segmento / Assunto</Label>
                            <Select value={segment} onValueChange={setSegment}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Plantas Daninhas">Plantas Daninhas</SelectItem>
                                    <SelectItem value="Herbicidas">Herbicidas</SelectItem>
                                    <SelectItem value="Fungicidas e Doenças">Fungicidas e Doenças</SelectItem>
                                    <SelectItem value="Inseticidas e Pragas">Inseticidas e Pragas</SelectItem>
                                    <SelectItem value="Nutrição Foliar">Nutrição Foliar</SelectItem>
                                    <SelectItem value="Fertilizantes de Solo">Fertilizantes de Solo</SelectItem>
                                    <SelectItem value="Adjuvantes">Adjuvantes</SelectItem>
                                    <SelectItem value="Sementes">Sementes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="file">Arquivo PDF</Label>
                            <Input
                                id="file"
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                className="cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={uploading}>Cancelar</Button>
                        <Button onClick={handleUpload} disabled={uploading || !file || !title} className="bg-blue-600 hover:bg-blue-700">
                            {uploading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Extraindo Texto...
                                </>
                            ) : "Salvar na Base"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
