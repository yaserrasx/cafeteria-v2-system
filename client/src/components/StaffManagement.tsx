import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface Staff {
  id: string;
  name: string;
  role: string;
  status: string;
  canLogin: boolean;
  createdAt: Date;
}

interface StaffManagementProps {
  cafeteriaId: string;
}

export function StaffManagement({ cafeteriaId }: StaffManagementProps) {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [editingCanLogin, setEditingCanLogin] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load staff
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const staffData = await trpc.staff.getStaff.query({
          cafeteriaId,
        });
        setStaff(staffData);
      } catch (error: any) {
        toast.error(error.message || "Failed to load staff");
      } finally {
        setLoading(false);
      }
    };

    loadStaff();
  }, [cafeteriaId]);

  const startEditing = (staffMember: Staff) => {
    setEditingStaffId(staffMember.id);
    setEditingRole(staffMember.role || "waiter");
    setEditingCanLogin(staffMember.canLogin);
  };

  const cancelEditing = () => {
    setEditingStaffId(null);
    setEditingRole("");
    setEditingCanLogin(false);
  };

  const saveChanges = async () => {
    if (!editingStaffId) return;

    setSaving(true);
    try {
      // Update role if changed
      const currentStaff = staff.find((s) => s.id === editingStaffId);
      if (currentStaff && currentStaff.role !== editingRole) {
        await trpc.staff.updateStaffRole.mutate({
          staffId: editingStaffId,
          newRole: editingRole as "admin" | "manager" | "waiter" | "chef",
        });
      }

      // Toggle login if changed
      if (currentStaff && currentStaff.canLogin !== editingCanLogin) {
        await trpc.staff.toggleStaffLogin.mutate({
          staffId: editingStaffId,
          enable: editingCanLogin,
        });
      }

      // Update local state
      setStaff(
        staff.map((s) =>
          s.id === editingStaffId
            ? { ...s, role: editingRole, canLogin: editingCanLogin }
            : s
        )
      );

      toast.success("Staff member updated successfully");
      cancelEditing();
    } catch (error: any) {
      toast.error(error.message || "Failed to update staff member");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading staff...</div>;
  }

  return (
    <div className="space-y-4">
      {staff.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-gray-600">No staff members found</p>
        </Card>
      ) : (
        staff.map((staffMember) => (
          <Card key={staffMember.id} className="p-6">
            {editingStaffId === staffMember.id ? (
              // Edit Mode
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-4">
                      {staffMember.name}
                    </h3>

                    {/* Role Selector */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">
                        Role
                      </label>
                      <Select
                        value={editingRole}
                        onValueChange={setEditingRole}
                      >
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                        <option value="waiter">Waiter</option>
                        <option value="chef">Chef</option>
                      </Select>
                    </div>

                    {/* Login Toggle */}
                    <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded">
                      <label className="text-sm font-medium">
                        Allow Login
                      </label>
                      <Switch
                        checked={editingCanLogin}
                        onCheckedChange={setEditingCanLogin}
                      />
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={cancelEditing}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={saveChanges}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            ) : (
              // View Mode
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {staffMember.name}
                  </h3>
                  <div className="flex gap-2 mb-3">
                    <Badge variant="outline">{staffMember.role}</Badge>
                    <Badge
                      variant={staffMember.status === "active" ? "default" : "secondary"}
                    >
                      {staffMember.status}
                    </Badge>
                    {staffMember.canLogin && (
                      <Badge variant="secondary">Login Enabled</Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Created:{" "}
                    {new Date(staffMember.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => startEditing(staffMember)}
                >
                  Edit
                </Button>
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
