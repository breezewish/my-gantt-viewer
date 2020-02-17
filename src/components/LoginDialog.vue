<template>
  <div class="modal-card" style="width: auto">
    <section class="modal-card-body" style="padding: 30px">
      <h1 class="title">Sign In</h1>
      <p>To continue, you need to sign-in use your GitHub account.</p>
      <div style="padding-top: 30px; text-align: center;">
        <b-button
          type="is-primary"
          @click="signin"
          :loading="isLoading"
          icon-left="github-circle"
        >
          Sign in use GitHub Account
        </b-button>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'LoginDialog',
  data() {
    return {
      isLoading: false,
    };
  },
  methods: {
    signin() {
      this.isLoading = true;
      window.location =
        '/github/signin?redirect=' + encodeURIComponent(window.location.href);
    },
  },
};
</script>
