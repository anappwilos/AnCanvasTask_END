import { defineField, defineType } from 'sanity'

export const workspace = defineType({
  name: 'workspace',
  title: 'Workspace',
  type: 'document',
  icon: () => '🏢',
  fields: [
    defineField({
      name: 'workspaceId',
      title: 'Workspace ID',
      type: 'string',
      description: 'Identificador único del workspace (ej. "ws_antask_monorepo", "ws_1720000000000")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'name',
      title: 'Nombre del Workspace',
      type: 'string',
      description: 'Nombre descriptivo del espacio de trabajo o proyecto',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'githubRepo',
      title: 'Repositorio GitHub',
      type: 'object',
      fields: [
        defineField({
          name: 'owner',
          title: 'Owner / Organización',
          type: 'string',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'repo',
          title: 'Nombre del Repositorio',
          type: 'string',
          validation: (Rule) => Rule.required(),
        }),
        defineField({
          name: 'fullName',
          title: 'Nombre Completo (owner/repo)',
          type: 'string',
          description: 'ej. "antask-org/antask-platform"',
        }),
        defineField({
          name: 'url',
          title: 'URL de GitHub',
          type: 'url',
        }),
        defineField({
          name: 'defaultBranch',
          title: 'Rama por Defecto',
          type: 'string',
          initialValue: 'main',
        }),
        defineField({
          name: 'isPrivate',
          title: 'Repositorio Privado',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'description',
          title: 'Descripción del Repositorio',
          type: 'text',
          rows: 2,
        }),
      ],
    }),
    defineField({
      name: 'activeBranchName',
      title: 'Rama Activa',
      type: 'string',
      description: 'Nombre de la rama Git actualmente seleccionada',
      initialValue: 'main',
    }),
    defineField({
      name: 'branches',
      title: 'Ramas Git & Documentos Task MD',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            defineField({
              name: 'name',
              title: 'Nombre de la Rama',
              type: 'string',
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: 'isProtected',
              title: 'Rama Protegida',
              type: 'boolean',
              initialValue: false,
            }),
            defineField({
              name: 'activeDocumentId',
              title: 'ID del Documento Activo',
              type: 'string',
            }),
            defineField({
              name: 'lastCommit',
              title: 'Último Commit',
              type: 'object',
              fields: [
                defineField({ name: 'hash', title: 'Commit Hash', type: 'string' }),
                defineField({ name: 'message', title: 'Mensaje', type: 'string' }),
                defineField({ name: 'author', title: 'Autor', type: 'string' }),
                defineField({ name: 'timestamp', title: 'Fecha/Hora', type: 'datetime' }),
              ],
            }),
            defineField({
              name: 'taskDocuments',
              title: 'Documentos TASKS.md',
              type: 'array',
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({
                      name: 'id',
                      title: 'ID del Documento',
                      type: 'string',
                      validation: (Rule) => Rule.required(),
                    }),
                    defineField({
                      name: 'name',
                      title: 'Nombre de Archivo',
                      type: 'string',
                      initialValue: 'TASKS.md',
                    }),
                    defineField({
                      name: 'folder',
                      title: 'Carpeta / Directorio',
                      type: 'string',
                      description: 'ej. "" (raíz), "frontend", "backend"',
                    }),
                    defineField({
                      name: 'path',
                      title: 'Ruta Completa',
                      type: 'string',
                      description: 'ej. "TASKS.md", "frontend/TASKS.md"',
                    }),
                    defineField({
                      name: 'content',
                      title: 'Contenido Markdown',
                      type: 'text',
                      rows: 8,
                    }),
                    defineField({
                      name: 'lastSavedContent',
                      title: 'Último Contenido Guardado',
                      type: 'text',
                      rows: 4,
                    }),
                    defineField({
                      name: 'updatedAt',
                      title: 'Fecha de Actualización',
                      type: 'datetime',
                    }),
                  ],
                  preview: {
                    select: {
                      title: 'path',
                      subtitle: 'name',
                    },
                  },
                },
              ],
            }),
          ],
          preview: {
            select: {
              title: 'name',
              isProtected: 'isProtected',
              docCount: 'taskDocuments.length',
            },
            prepare(selection: any) {
              const { title, isProtected, docCount } = selection
              const prot = isProtected ? '🔒 ' : '🌿 '
              return {
                title: `${prot}${title || 'rama'}`,
                subtitle: `${docCount || 0} archivos Task MD`,
              }
            },
          },
        },
      ],
    }),
    defineField({
      name: 'tasks',
      title: 'Tareas Directas del Workspace (Tasks)',
      type: 'array',
      description: 'Tareas asociadas directamente a este workspace',
      of: [{ type: 'reference', to: [{ type: 'task' }] }],
    }),
    defineField({
      name: 'createdAt',
      title: 'Fecha de Creación',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
    defineField({
      name: 'updatedAt',
      title: 'Última Actualización',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: 'name',
      repoName: 'githubRepo.fullName',
      activeBranch: 'activeBranchName',
      branches: 'branches',
    },
    prepare(selection: any) {
      const { title, repoName, activeBranch, branches } = selection
      const count = Array.isArray(branches) ? branches.length : 0
      return {
        title: `🏢 ${title || 'Sin nombre'}`,
        subtitle: `${repoName || 'Sin repositorio'} · ${count} rama(s) [activa: ${activeBranch || 'main'}]`,
      }
    },
  },
})

export default workspace
