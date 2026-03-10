import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, QrCode, Download, RefreshCw } from "lucide-react";

interface TableQRManagerProps {
  cafeteriaId: string;
}

export function TableQRManager({ cafeteriaId }: TableQRManagerProps) {
  const [tables, setTables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const fetchTables = async () => {
    try {
      const data = await trpc.tables.getTables.query({ cafeteriaId });
      setTables(data);
    } catch (error: any) {
      toast.error("Failed to fetch tables: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (cafeteriaId) {
      fetchTables();
    }
  }, [cafeteriaId]);

  const handleRegenerateToken = async (tableId: string) => {
    setRegenerating(tableId);
    try {
      await trpc.tables.regenerateTableToken.mutate({ tableId });
      toast.success("QR Token regenerated successfully");
      await fetchTables();
    } catch (error: any) {
      toast.error("Failed to regenerate token: " + error.message);
    } finally {
      setRegenerating(null);
    }
  };

  const getQRUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/menu/${token}`;
  };

  const downloadQR = (tableNumber: number, token: string) => {
    const url = getQRUrl(token);
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
    
    const link = document.createElement("a");
    link.href = qrApiUrl;
    link.download = `Table_${tableNumber}_QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info(`Downloading QR for Table ${tableNumber}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-gray-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tables.map((table) => (
        <Card key={table.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-lg">Table {table.tableNumber}</CardTitle>
              <Badge variant={table.status === "available" ? "default" : "secondary"}>
                {table.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <div className="bg-white p-2 border rounded-lg">
                {table.tableToken ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(getQRUrl(table.tableToken))}`}
                    alt={`QR for Table ${table.tableNumber}`}
                    className="w-32 h-32"
                  />
                ) : (
                  <div className="w-32 h-32 flex items-center justify-center bg-gray-100 text-gray-400">
                    <QrCode className="w-12 h-12" />
                  </div>
                )}
              </div>
              
              <div className="text-xs text-gray-500 break-all text-center px-2">
                {table.tableToken ? getQRUrl(table.tableToken) : "No token generated"}
              </div>

              <div className="flex w-full gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => downloadQR(table.tableNumber, table.tableToken)}
                  disabled={!table.tableToken}
                >
                  <Download className="w-4 h-4 mr-1" />
                  PNG
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleRegenerateToken(table.id)}
                  disabled={regenerating === table.id}
                >
                  {regenerating === table.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Reset
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
