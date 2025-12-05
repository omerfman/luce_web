'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/AuthContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ModalFooter } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import { Project, ProjectStatus } from '@/types';
import Link from 'next/link';

export default function ProjectsPage() {
  const { company, hasPermission } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    start_date: '',
    end_date: '',
    status: 'planned' as ProjectStatus,
  });

  const canCreate = hasPermission('projects', 'create');
  const canUpdate = hasPermission('projects', 'update');
  const canDelete = hasPermission('projects', 'delete');

  useEffect(() => {
    if (company) {
      loadProjects();
    }
  }, [company]);

  async function loadProjects() {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('company_id', company!.id);

      if (error) throw error;
      
      // Sort projects: if name starts with number, sort numerically, otherwise alphabetically
      const sortedProjects = (data || []).sort((a, b) => {
        const aFirstWord = a.name.split(' ')[0];
        const bFirstWord = b.name.split(' ')[0];
        const aNum = parseInt(aFirstWord);
        const bNum = parseInt(bFirstWord);
        
        const aIsNumber = !isNaN(aNum);
        const bIsNumber = !isNaN(bNum);
        
        if (aIsNumber && bIsNumber) {
          // Both start with numbers, sort numerically
          return aNum - bNum;
        } else if (aIsNumber) {
          // Only a starts with number, a comes first
          return -1;
        } else if (bIsNumber) {
          // Only b starts with number, b comes first
          return 1;
        } else {
          // Neither starts with number, sort alphabetically
          return a.name.localeCompare(b.name, 'tr');
        }
      });
      
      setProjects(sortedProjects);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!company) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('projects').insert({
        company_id: company.id,
        name: formData.name,
        description: formData.description || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        status: formData.status,
      });

      if (error) throw error;

      // Reset form
      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: ProjectStatus.PLANNED,
      });
      setIsModalOpen(false);
      loadProjects();
    } catch (error: any) {
      console.error('Error creating project:', error);
      alert(error.message || 'Proje oluşturulurken hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openEditModal(project: Project, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProject(project);
    setFormData({
      name: project.name,
      description: project.description || '',
      start_date: project.start_date || '',
      end_date: project.end_date || '',
      status: project.status as ProjectStatus,
    });
    setIsEditModalOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('projects')
        .update({
          name: formData.name,
          description: formData.description || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
        })
        .eq('id', selectedProject.id);

      if (error) throw error;

      setFormData({
        name: '',
        description: '',
        start_date: '',
        end_date: '',
        status: ProjectStatus.PLANNED,
      });
      setSelectedProject(null);
      setIsEditModalOpen(false);
      loadProjects();
    } catch (error: any) {
      console.error('Error updating project:', error);
      alert(error.message || 'Proje güncellenirken hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(project: Project, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`"${project.name}" projesini silmek istediğinizden emin misiniz?`)) return;

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) throw error;
      loadProjects();
    } catch (error: any) {
      console.error('Error deleting project:', error);
      alert(error.message || 'Proje silinirken hata oluştu');
    }
  }

  const statusLabels: Record<ProjectStatus, string> = {
    planned: 'Planlanıyor',
    active: 'Aktif',
    on_hold: 'Beklemede',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
  };

  const statusColors: Record<ProjectStatus, string> = {
    planned: 'bg-blue-100 text-blue-700',
    active: 'bg-green-100 text-green-700',
    on_hold: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  if (isLoading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center py-12">
          <div className="text-secondary-600">Yükleniyor...</div>
        </div>
      </Sidebar>
    );
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900">Projeler</h1>
            <p className="mt-1 text-sm text-secondary-600">
              Toplam {projects.length} proje
            </p>
          </div>
          {canCreate && (
            <Button onClick={() => setIsModalOpen(true)}>
              Yeni Proje Oluştur
            </Button>
          )}
        </div>

        {/* Projects Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.length === 0 ? (
            <Card className="col-span-full">
              <div className="py-12 text-center text-sm text-secondary-500">
                Henüz proje bulunmuyor
              </div>
            </Card>
          ) : (
            projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <Card hover className="h-full cursor-pointer">
                  <div className="mb-3 flex items-start justify-between">
                    <h3 className="text-lg font-semibold text-secondary-900">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          statusColors[project.status as ProjectStatus]
                        }`}
                      >
                        {statusLabels[project.status as ProjectStatus]}
                      </span>
                    </div>
                  </div>

                  {project.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-secondary-600">
                      {project.description}
                    </p>
                  )}

                  <div className="space-y-1 text-xs text-secondary-500">
                    {project.start_date && (
                      <div>
                        <span className="font-medium">Başlangıç:</span>{' '}
                        {formatDate(project.start_date)}
                      </div>
                    )}
                    {project.end_date && (
                      <div>
                        <span className="font-medium">Bitiş:</span>{' '}
                        {formatDate(project.end_date)}
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  {(canUpdate || canDelete) && (
                    <div className="mt-4 flex gap-2 border-t border-secondary-200 pt-3">
                      {canUpdate && (
                        <button
                          onClick={(e) => openEditModal(project, e)}
                          className="flex-1 rounded-md bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-primary-100"
                        >
                          Düzenle
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => handleDelete(project, e)}
                          className="flex-1 rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
                        >
                          Sil
                        </button>
                      )}
                    </div>
                  )}
                </Card>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Yeni Proje Oluştur"
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Proje Adı"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Açıklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Başlangıç Tarihi"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="Bitiş Tarihi"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Durum
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as ProjectStatus })
              }
              className="input"
            >
              <option value="planned">Planlanıyor</option>
              <option value="active">Aktif</option>
              <option value="on_hold">Beklemede</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Proje Oluştur
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Proje Düzenle"
        size="lg"
      >
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Proje Adı"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Textarea
            label="Açıklama"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={3}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Başlangıç Tarihi"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
            <Input
              label="Bitiş Tarihi"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary-700">
              Durum
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value as ProjectStatus })
              }
              className="input"
            >
              <option value="planned">Planlanıyor</option>
              <option value="active">Aktif</option>
              <option value="on_hold">Beklemede</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>

          <ModalFooter>
            <Button type="button" variant="ghost" onClick={() => setIsEditModalOpen(false)}>
              İptal
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Güncelle
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </Sidebar>
  );
}
