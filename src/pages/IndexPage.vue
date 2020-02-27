<template>
  <div>
    <vue-headful title="GanttViewer" />
    <section class="hero is-primary">
      <div class="hero-body">
        <div class="container">
          <h1 class="title">
            GanttViewer
          </h1>
        </div>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h1 class="title">Getting Started</h1>
        <p>↑ Input the repository in the navigation bar.</p>
      </div>
    </section>
    <section class="section">
      <div class="container">
        <h1 class="title">Changelog</h1>
        <ul>
          <li>
            <b-tag>2020-02-27</b-tag> Support export and import local panel JSON
          </li>
          <li><b-tag>2020-02-26</b-tag> Support local panels</li>
          <li><b-tag>2020-02-24</b-tag> Support private repository</li>
        </ul>
      </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'IndexPage',
};
</script>
