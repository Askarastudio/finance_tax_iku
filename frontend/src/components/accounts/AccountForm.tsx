import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Account, 
  AccountType, 
  CreateAccountRequest, 
  UpdateAccountRequest, 
  ACCOUNT_TYPES,
  validateAccountCode,
  getAccountTypeFromCode,
  validateAccountHierarchy
} from '@/types/account';

interface AccountFormProps {
  account?: Account;
  parentAccounts?: Account[];
  onSubmit: (data: CreateAccountRequest | UpdateAccountRequest) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function AccountForm({ 
  account, 
  parentAccounts = [], 
  onSubmit, 
  onCancel, 
  isLoading = false 
}: AccountFormProps) {
  const [formData, setFormData] = useState({
    code: account?.code || '',
    name: account?.name || '',
    type: account?.type || '' as AccountType,
    parentId: account?.parentId || '',
    description: account?.description || '',
    isActive: account?.isActive ?? true
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [codeValidation, setCodeValidation] = useState<{
    isValid: boolean;
    message: string;
  }>({ isValid: true, message: '' });

  const isEditing = !!account;

  // Validate account code in real-time
  useEffect(() => {
    if (!formData.code) {
      setCodeValidation({ isValid: true, message: '' });
      return;
    }

    const isValidFormat = validateAccountCode(formData.code);
    if (!isValidFormat) {
      setCodeValidation({
        isValid: false,
        message: 'Kode akun harus 4 digit dengan format: 1xxx (Aset), 2xxx (Kewajiban), 3xxx (Ekuitas), 4xxx (Pendapatan), 5xxx (Beban)'
      });
      return;
    }

    const typeFromCode = getAccountTypeFromCode(formData.code);
    if (typeFromCode && formData.type && typeFromCode !== formData.type) {
      setCodeValidation({
        isValid: false,
        message: `Kode akun ${formData.code} tidak sesuai dengan tipe ${ACCOUNT_TYPES.find(t => t.value === formData.type)?.label}`
      });
      return;
    }

    // Check hierarchy if parent is selected
    if (formData.parentId) {
      const parent = parentAccounts.find(p => p.id === formData.parentId);
      if (parent && !validateAccountHierarchy(parent.code, formData.code)) {
        setCodeValidation({
          isValid: false,
          message: `Kode akun anak harus dimulai dengan kode akun induk (${parent.code})`
        });
        return;
      }
    }

    setCodeValidation({ isValid: true, message: 'Kode akun valid' });
  }, [formData.code, formData.type, formData.parentId, parentAccounts]);

  // Auto-set type based on code
  useEffect(() => {
    if (formData.code && validateAccountCode(formData.code)) {
      const typeFromCode = getAccountTypeFromCode(formData.code);
      if (typeFromCode && typeFromCode !== formData.type) {
        setFormData(prev => ({ ...prev, type: typeFromCode }));
      }
    }
  }, [formData.code]);

  const handleInputChange = (field: string, value: string | boolean) => {
    // Handle special case for parentId "none" value
    if (field === 'parentId' && value === 'none') {
      setFormData(prev => ({ ...prev, [field]: '' }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.code.trim()) {
      newErrors.code = 'Kode akun wajib diisi';
    } else if (!codeValidation.isValid) {
      newErrors.code = codeValidation.message;
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Nama akun wajib diisi';
    }

    if (!formData.type) {
      newErrors.type = 'Tipe akun wajib dipilih';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      if (isEditing) {
        const updateData: UpdateAccountRequest = {
          name: formData.name,
          description: formData.description || undefined,
          isActive: formData.isActive
        };
        await onSubmit(updateData);
      } else {
        const createData: CreateAccountRequest = {
          code: formData.code,
          name: formData.name,
          type: formData.type,
          parentId: formData.parentId || undefined,
          description: formData.description || undefined
        };
        await onSubmit(createData);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    }
  };

  // Filter parent accounts based on selected type
  const availableParents = parentAccounts.filter(parent => 
    parent.type === formData.type && parent.id !== account?.id
  );

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>
          {isEditing ? 'Edit Akun' : 'Tambah Akun Baru'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Account Code */}
          <div className="space-y-2">
            <Label htmlFor="code">Kode Akun *</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              placeholder="Contoh: 1100"
              disabled={isEditing || isLoading}
              className={errors.code ? 'border-red-500' : ''}
            />
            {codeValidation.message && (
              <p className={`text-sm ${codeValidation.isValid ? 'text-green-600' : 'text-red-600'}`}>
                {codeValidation.message}
              </p>
            )}
            {errors.code && (
              <p className="text-sm text-red-600">{errors.code}</p>
            )}
          </div>

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nama Akun *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Contoh: Kas"
              disabled={isLoading}
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && (
              <p className="text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipe Akun *</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => handleInputChange('type', value as AccountType)}
              disabled={isEditing || isLoading}
            >
              <SelectTrigger className={errors.type ? 'border-red-500' : ''}>
                <SelectValue placeholder="Pilih tipe akun" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label} ({type.prefix}xxx)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && (
              <p className="text-sm text-red-600">{errors.type}</p>
            )}
          </div>

          {/* Parent Account */}
          {availableParents.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="parentId">Akun Induk (Opsional)</Label>
              <Select
                value={formData.parentId || 'none'}
                onValueChange={(value) => handleInputChange('parentId', value)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih akun induk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tidak ada induk</SelectItem>
                  {availableParents.map((parent) => (
                    <SelectItem key={parent.id} value={parent.id}>
                      {parent.code} - {parent.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi (Opsional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Deskripsi akun..."
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Active Status (only for editing) */}
          {isEditing && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                disabled={isLoading}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isActive">Akun aktif</Label>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex justify-end space-x-4 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !codeValidation.isValid}
            >
              {isLoading ? 'Menyimpan...' : (isEditing ? 'Update' : 'Simpan')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}