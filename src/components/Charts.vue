<template>
  <div>
    <!-- <LineChart class="chart" :chartData="hatCountData" :options="hatCountOptions"/> -->
    <BarChart class="chart" :chartData="hatAdditionAgesData" :options="hatAdditionAgesOptions"/>
  </div>
</template>

<script>
import { LineChart, BarChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import randomColor from 'randomcolor';

Chart.register(...registerables);

export default {
  components: {
    BarChart,
    LineChart
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
    inHatNowGroupedByMonth () {
      return this.inHatNow.reduce((acc, timestamp) => {
        const date = new Date(timestamp);
        const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!acc[month]) {
          acc[month] = 0;
        }

        acc[month]++;

        return acc;
      }, {});
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
    usedToBeInHat () {
      if (!this.$store.state.history) {
        return [];
      }

      return this.$store.state.history.map((result) => {
        if (result.timeStamp) {
          return result.timeStamp;
        } else {
          return 1598932800000;
        }
      }).sort((a, b) => a - b);
    },
    allAddedDates () {
      if (!this.$store.state.movieHat) {
        return [];
      }

      return this.inHatNow.concat(this.usedToBeInHat);
    },
    subtractedDates () {
      if (!this.$store.state.history) {
        return [];
      }

      return this.$store.state.history.map((result) => {
        return result.dateDrawn;
      }).sort((a, b) => a - b);
    },
    hatCountData () {
      const labels = Object.keys(this.monthByMonthChanges).sort((a, b) => new Date(a) - new Date(b));
      const changes = labels.map((month) => {
        return this.monthByMonthChanges[month];
      });
      const data = this.convertChangesToValues(changes);

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
    hatCountOptions () {
      return {
        plugins: {
          legend: {
            display: false
          },
          title: {
            display: true,
            text: "Hat Size Over Time",
          },
        },
        backgroundColor: 'rgba(100, 100, 0, 1)',
        scales: {
          x: {
            display: true
          }
        }
      }
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
    },
    numberOfMoviesAddedByMonth () {
      return this.allAddedDates.reduce((acc, timestamp) => {
        const date = new Date(timestamp);
        const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!acc[month]) {
          acc[month] = 0;
        }

        acc[month]++;

        return acc;
      }, {});
    },
    numberOfMoviesSubtractedByMonth () {
      return this.subtractedDates.reduce((acc, dateDrawn) => {
        const date = new Date(dateDrawn);
        const month = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;

        if (!acc[month]) {
          acc[month] = 0;
        }

        acc[month]--;

        return acc;
      }, {});
    },
    monthByMonthChanges () {
      const changes = {};
      const addMonths = Object.keys(this.numberOfMoviesAddedByMonth);
      const subtractMonths = Object.keys(this.numberOfMoviesSubtractedByMonth);
      const allMonths = addMonths.concat(subtractMonths);

      allMonths.forEach((month) => {
        changes[month] = 0;

        if (this.numberOfMoviesAddedByMonth[month]) {
          changes[month] += this.numberOfMoviesAddedByMonth[month];
        }

        if (this.numberOfMoviesSubtractedByMonth[month]) {
          changes[month] += this.numberOfMoviesSubtractedByMonth[month];
        }
      });

      return changes;
    }
  },
  methods: {
    convertChangesToValues (changeArray) {
      const values = [];

      changeArray.forEach((change) => {
        if (!values[0]) {
          values.push(change);
        } else {
          values.push(values[values.length - 1] + change);
        }
      });

      return values;
    }
  },
};
</script>

<style lang="scss">

</style>