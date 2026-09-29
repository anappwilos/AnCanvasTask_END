// @ts-nocheck
import { defineField, defineType } from 'sanity'

export const task = defineType({
  name: 'task',
  title: 'Task',
  type: 'document',
  icon: () => '📋',
  fields: [
    defineField({
      name: 'taskId',
      title: 'Task ID',
      type: 'string',
      description: 'Identificador único de la tarea (ej. "oauth", "session", "profile")',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Título',
      type: 'string',
      description: 'Nombre o título descriptivo de la tarea',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'completed',
      title: 'Completada',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'status',
      title: 'Estado Kanban',
      type: 'string',
      options: {
        list: [
          { title: 'Por hacer (Todo)', value: 'todo' },
          { title: 'En progreso (In Progress)', value: 'in_progress' },
          { title: 'Bloqueada (Blocked)', value: 'blocked' },
          { title: 'Completada (Done)', value: 'done' },
        ],
        layout: 'radio',
      },
      initialValue: 'todo',
    }),
    defineField({
      name: 'priority',
      title: 'Prioridad',
      type: 'string',
      options: {
        list: [
          { title: 'P0 - Crítica', value: 'P0' },
          { title: 'P1 - Alta', value: 'P1' },
          { title: 'P2 - Media', value: 'P2' },
          { title: 'P3 - Baja', value: 'P3' },
        ],
      },
      initialValue: 'P1',
    }),
    defineField({
      name: 'groupTitle',
      title: 'Sección / Grupo',
      type: 'string',
      description: 'Sección en TASKS.md a la que pertenece',
      initialValue: 'General',
    }),
    defineField({
      name: 'blockedBy',
      title: 'Bloqueada Por (Task ID)',
      type: 'string',
      description: 'ID de la tarea bloqueante en el grafo DAG',
    }),
    defineField({
      name: 'tags',
      title: 'Etiquetas (#tags)',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        layout: 'tags',
      },
    }),
    defineField({
      name: 'subtasks',
      title: 'Subtareas (Checklist)',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'title', title: 'Título de la subtarea', type: 'string' },
            { name: 'completed', title: 'Completada', type: 'boolean', initialValue: false },
          ],
        },
      ],
    }),
    defineField({
      name: 'description',
      title: 'Descripción / Notas',
      type: 'text',
      rows: 3,
    }),
    defineField({
      name: 'updatedAt',
      title: 'Última actualización',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'groupTitle',
      priority: 'priority',
      completed: 'completed',
    },
    prepare({ title, subtitle, priority, completed }) {
      const statusIcon = completed ? '✅' : '⏳';
      return {
        title: `${statusIcon} [${priority || 'P1'}] ${title || 'Sin título'}`,
        subtitle: `Sección: ${subtitle || 'General'}`,
      };
    },
  },
})
