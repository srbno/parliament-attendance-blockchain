<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h2 class="text-xl font-semibold">Deputados</h2>
      <UBadge color="gray" variant="soft">{{ deputies?.length ?? 0 }} registos</UBadge>
    </div>

    <UCard>
      <UTable
        :rows="deputies ?? []"
        :columns="columns"
        :loading="pending"
        @select="onSelectDeputy"
      >
        <template #active-data="{ row }">
          <UBadge :color="row.active ? 'green' : 'gray'" variant="soft">
            {{ row.active ? 'Ativo' : 'Inativo' }}
          </UBadge>
        </template>
      </UTable>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import type { Deputy } from '~/composables/useDeputies'

const { fetchAll } = useDeputies()
const { data: deputies, pending } = await useAsyncData('deputies', fetchAll)

const columns = [
  { key: 'name', label: 'Nome' },
  { key: 'party', label: 'Partido' },
  { key: 'electoralCircle', label: 'Círculo' },
  { key: 'active', label: 'Estado' },
]

const onSelectDeputy = (row: Deputy) => {
  navigateTo(`/deputies/${row.id}`)
}
</script>
