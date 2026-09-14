// Vue CLI ran every stylesheet through autoprefixer against the browserslist
// block in package.json; Vite only does so when a PostCSS config is present,
// so this keeps the shipped CSS the same. It matters on iOS, where the
// properties Safari still wants prefixed were only ever getting their
// -webkit- twins because of this pass.
module.exports = {
  plugins: {
    autoprefixer: {},
  },
};
