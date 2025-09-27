<template>
  <h1 class="h4 mb-3">Messages</h1>
  <div class="row">
    <div class="col-md-4">
      <div class="list-group">
        <a v-for="n in 5" :key="n" href="#" class="list-group-item list-group-item-action">
          Conversation {{ n }}
        </a>
      </div>
    </div>
    <div class="col-md-8">
      <div class="card p-3">Chat area</div>
    </div>
  </div>
</template>
