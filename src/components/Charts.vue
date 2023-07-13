<template>
  <div>
    <LineChart class="chart" :chartData="hatCountData" :options="hatCountOptions"/>
  </div>
</template>

<script>
import { LineChart } from "vue-chart-3";
import { Chart, registerables } from "chart.js";
import randomColor from 'randomcolor';

Chart.register(...registerables);

export default {
  components: {
    LineChart
  },
  computed: {
    addedDates () {
      if (!this.$store.state.movieHat) {
        return [];
      }

      const inHatNow = this.$store.state.movieHat.map((result) => {
        return result.timeStamp;
      }).sort((a, b) => a - b);

      const usedToBeInHat = this.$store.state.history.map((result) => {
        if (result.timeStamp) {
          return result.timeStamp;
        } else {
          return 1598932800000;
        }
      }).sort((a, b) => a - b);

      return inHatNow.concat(usedToBeInHat);
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
    numberOfMoviesAddedByMonth () {
      return this.addedDates.reduce((acc, timestamp) => {
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