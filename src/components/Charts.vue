<template>
  <div>
    <BarChart class="chart" :chartData="hatAdditionAgesData" :options="hatAdditionAgesOptions"/>
  </div>
</template>

<script>
import { BarChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import randomColor from 'randomcolor';

Chart.register(...registerables);

export default {
  components: {
    BarChart
  },
  computed: {
    inHatNow () {
      if (!this.$store.state.movieHat) {
        return [];
      }

      return this.$store.state.movieHat.map((result) => {
        return result.timeStamp;
      }).sort((a, b) => a - b);
    },
    inHatNowGroupedByAge () {
      const now = new Date();
      return this.inHatNow.reduce((acc, timestamp) => {
        const date = new Date(timestamp);
        const diffYears = now.getFullYear() - date.getFullYear();
        const diffMonths = (now.getMonth() - date.getMonth()) + (12 * diffYears);
        let category;

        if (diffMonths > 60) { // Older than 5 years
          category = 'older than 5 years';
        } else if (diffMonths > 48) { // Older than 4 years
          category = 'older than 4 years';
        } else if (diffMonths > 36) { // Older than 3 years
          category = 'older than 3 years';
        } else if (diffMonths > 24) { // Older than 3 years
          category = 'older than 2 years';
        } else if (diffMonths > 12) { // Older than 1 year
          category = 'older than 1 year';
        } else if (diffMonths > 6) { // Older than 6 months
          category = 'older than 6 months';
        } else if (diffMonths > 1) { // Older than 1 month
          category = 'older than 1 month';
        } else { // Everything else
          category = 'everything else';
        }

        if (!acc[category]) {
          acc[category] = 0;
        }

        acc[category]++;

        return acc;
      }, {});
    },
    hatAdditionAgesData () {
      const labels = Object.keys(this.inHatNowGroupedByAge).sort((a, b) => new Date(a) - new Date(b));
      const data = labels.map((month) => {
        return this.inHatNowGroupedByAge[month];
      });

      const color = randomColor();

      return {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: color,
            borderColor: color,
            tension: 0.5
          }
        ]
      }
    },
    hatAdditionAgesOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Age of Movies Added to Hat",
          },
        },
        backgroundColor: 'rgba(100, 100, 0, 1)',
        scales: {
          x: {
            display: true
          }
        },
        animation: {
          duration: 2000,
          easing: 'easeInOutQuad'
        },
        elements: {
          bar: {
            borderRadius: 3
          },
        }
      }
    }
  },
};
</script>

<style lang="scss">

</style>