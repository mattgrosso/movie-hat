<template>
  <div class="charts-inner">
    <figure v-if="sizeOverTime.labels.length > 1" class="chart-card">
      <figcaption>How full the hat has been</figcaption>
      <div class="plot"><LineChart :chartData="sizeData" :options="lineOptions"/></div>
    </figure>

    <figure v-if="inOut.labels.length" class="chart-card">
      <figcaption>In and out, by year</figcaption>
      <div class="plot"><BarChart :chartData="inOutData" :options="groupedBarOptions"/></div>
    </figure>

    <figure v-if="decades.labels.length" class="chart-card">
      <figcaption>Every movie the hat has held, by decade</figcaption>
      <div class="plot"><BarChart :chartData="decadesData" :options="barOptions"/></div>
    </figure>

    <figure v-if="waiting.total" class="chart-card">
      <figcaption>How long the movies in the hat have waited so far</figcaption>
      <div class="plot"><BarChart :chartData="waitingData" :options="barOptions"/></div>
    </figure>

    <figure v-if="drawnWaits.total" class="chart-card">
      <figcaption>How long drawn movies waited before their night</figcaption>
      <div class="plot"><BarChart :chartData="drawnWaitsData" :options="barOptions"/></div>
    </figure>

    <figure v-if="contributors.labels.length > 1" class="chart-card">
      <figcaption>Who fills the hat</figcaption>
      <div class="plot"><BarChart :chartData="contributorsData" :options="horizontalBarOptions"/></div>
    </figure>
  </div>
</template>

<script>
import { BarChart, LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import {
  hatSizeOverTime,
  inAndOutByYear,
  byReleaseDecade,
  waitTimes,
  byContributor,
  agesInHat,
  monthLabel
} from "../assets/javascript/hatCharts.js";

Chart.register(...registerables);

// The two series colours, checked with the dataviz validator against the
// white card these sit on: lightness band, chroma floor, CVD separation
// (ΔE 22.7 protan), normal-vision floor and contrast all pass. Single-series
// charts use INK alone — a lone series needs no palette, and its caption
// already names it.
const INK = '#2f6fae';
const ACCENT = '#c8791f';
const GRID = 'rgba(0, 0, 0, 0.08)';
const LABEL = '#5a6675';

// Shared chart furniture: recessive grid and axes, no legend for a lone
// series, tooltips on by default (a chart you can touch should answer).
const base = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1d2430',
      padding: 10,
      displayColors: false
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: LABEL, font: { size: 10 } }
    },
    y: {
      beginAtZero: true,
      grid: { color: GRID, drawBorder: false },
      ticks: { color: LABEL, font: { size: 10 }, precision: 0 }
    }
  }
};

// Thin marks with rounded data-ends, and a hairline of surface between
// adjacent fills.
const barMark = {
  borderRadius: 4,
  borderSkipped: false,
  borderWidth: 1,
  borderColor: '#ffffff',
  maxBarThickness: 34
};

const merge = (extra = {}) => ({
  ...base,
  ...extra,
  plugins: { ...base.plugins, ...(extra.plugins || {}) },
  scales: { ...base.scales, ...(extra.scales || {}) }
});

export default {
  components: {
    BarChart,
    LineChart
  },
  computed: {
    inHat () {
      return this.$store.state.movieHat || [];
    },
    history () {
      return this.$store.state.history || [];
    },

    // --- the numbers -----------------------------------------------------
    sizeOverTime () {
      return hatSizeOverTime(this.inHat, this.history);
    },
    inOut () {
      return inAndOutByYear(this.inHat, this.history);
    },
    decades () {
      return byReleaseDecade(this.inHat, this.history);
    },
    waiting () {
      const data = agesInHat(this.inHat);
      return { ...data, total: data.values.reduce((sum, value) => sum + value, 0) };
    },
    drawnWaits () {
      const data = waitTimes(this.history);
      return { ...data, total: data.values.reduce((sum, value) => sum + value, 0) };
    },
    contributors () {
      return byContributor(this.inHat, this.history);
    },

    // --- the charts ------------------------------------------------------
    sizeData () {
      return {
        labels: this.sizeOverTime.labels.map(monthLabel),
        datasets: [{
          data: this.sizeOverTime.values,
          borderColor: INK,
          backgroundColor: 'rgba(47, 111, 174, 0.12)',
          borderWidth: 2,
          fill: true,
          tension: 0.25,
          pointRadius: 0,
          pointHoverRadius: 5,
          pointHitRadius: 16
        }]
      };
    },
    inOutData () {
      return {
        labels: this.inOut.labels,
        datasets: [
          { label: 'Added', data: this.inOut.added, backgroundColor: INK, ...barMark },
          { label: 'Drawn', data: this.inOut.drawn, backgroundColor: ACCENT, ...barMark }
        ]
      };
    },
    decadesData () {
      return { labels: this.decades.labels, datasets: [{ data: this.decades.values, backgroundColor: INK, ...barMark }] };
    },
    waitingData () {
      return { labels: this.waiting.labels, datasets: [{ data: this.waiting.values, backgroundColor: INK, ...barMark }] };
    },
    drawnWaitsData () {
      return { labels: this.drawnWaits.labels, datasets: [{ data: this.drawnWaits.values, backgroundColor: ACCENT, ...barMark }] };
    },
    contributorsData () {
      return { labels: this.contributors.labels, datasets: [{ data: this.contributors.values, backgroundColor: INK, ...barMark }] };
    },

    // --- the options -----------------------------------------------------
    lineOptions () {
      return merge({
        plugins: {
          tooltip: {
            ...base.plugins.tooltip,
            callbacks: {
              label: (item) => `${item.parsed.y} in the hat`
            }
          }
        },
        scales: {
          ...base.scales,
          // A hat with years of history has too many months to label; show a
          // readable handful and let the tooltip do the rest.
          x: { ...base.scales.x, ticks: { ...base.scales.x.ticks, maxTicksLimit: 6, autoSkip: true } }
        }
      });
    },
    barOptions () {
      return merge({});
    },
    groupedBarOptions () {
      // Two series, so the legend is not optional.
      return merge({ plugins: { ...base.plugins, legend: { display: true, labels: { color: LABEL, boxWidth: 10, font: { size: 10 } } } } });
    },
    horizontalBarOptions () {
      return merge({ indexAxis: 'y' });
    }
  }
};
</script>

<style lang="scss">
.charts-inner {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;

  // NO vertical padding here. Hat.vue puts the collapsing `.charts` class
  // on this very element, and padding survives `max-height: 0` — 8px of
  // padding-bottom left the top edge of the first frame peeking out while
  // the drawer was shut. Breathing room below comes from the last card's
  // margin instead, which the overflow clips properly.

  // Each chart in its own mat, like everything else in this app.
  .chart-card {
    background: white;
    border: 6px solid black;
    margin: 0;
    padding: 12px 12px 8px;

    &:last-child {
      margin-bottom: 0.5rem;
    }

    figcaption {
      color: #1d2430;
      font-size: 0.7rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      margin-bottom: 8px;
      text-align: center;
      text-transform: uppercase;
    }

    .plot {
      height: 190px;
      position: relative;

      // vue-chart-3 puts its own wrapper div between this and the canvas,
      // and that wrapper carries chart.js's default 400px height — so the
      // canvas sized to THAT and spilled over the next card. Making the
      // wrapper fill the plot is what actually constrains the chart.
      > div {
        height: 100%;
        position: relative;
        width: 100%;
      }

      canvas {
        max-height: 100%;
      }
    }
  }
}
</style>
