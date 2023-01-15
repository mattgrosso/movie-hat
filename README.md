# movie-hat

## Build Setup

[install homebrew](https://docs.brew.sh/Installation)

```bash
# install dependencies
brew install asdf

asdf plugin add nodejs

asdf plugin add yarn

asdf install

yarn install

# serve with hot reload at localhost:8000
yarn dev

# build for production and launch server
yarn build
yarn start

# generate static project
yarn generate

# deploy using surge.sh (you might need to run `export NODE_OPTIONS=--openssl-legacy-provider`)
yarn deploy

```

Sentry is set up to record errors (I think. It's possible that they want money)
https://sentry.io/organizations/matthew-grosso/issues/?query=is%3Aunresolved

For detailed explanation on how things work, check out [Nuxt.js docs](https://nuxtjs.org).
