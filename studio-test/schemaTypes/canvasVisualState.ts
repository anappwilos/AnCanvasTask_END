// @ts-nocheck
import { defineField, defineType } from 'sanity'

export const canvasVisualState = defineType({
  name: 'canvasVisualState',
  title: 'Canvas Visual State',
  type: 'document',
  icon: () => '🗺️',
  fields: [
    defineField({
      name: 'projectId',
      title: 'Project ID',
      type: 'string',
      initialValue: 'default',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'tasks',
      title: 'Posiciones de Tareas en Canvas',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'taskId', title: 'Task ID', type: 'string' },
            { name: 'x', title: 'X', type: 'number' },
            { name: 'y', title: 'Y', type: 'number' },
            { name: 'width', title: 'Width', type: 'number' },
            { name: 'height', title: 'Height', type: 'number' },
          ],
        },
      ],
    }),
    defineField({
      name: 'groups',
      title: 'Posiciones de Grupos en Canvas',
      type: 'array',
      of: [
        {
          type: 'object',
          fields: [
            { name: 'groupTitle', title: 'Título del Grupo', type: 'string' },
            { name: 'x', title: 'X', type: 'number' },
            { name: 'y', title: 'Y', type: 'number' },
            { name: 'width', title: 'Width', type: 'number' },
            { name: 'height', title: 'Height', type: 'number' },
            { name: 'isCollapsed', title: 'Colapsado', type: 'boolean' },
          ],
        },
      ],
    }),
    defineField({
      name: 'updatedAt',
      title: 'Última actualización',
      type: 'datetime',
      initialValue: () => new Date().toISOString(),
    }),
  ],
})
