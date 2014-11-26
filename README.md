# Cowboy

Integrates Gnome Shell with Remember the Milk.

## Install

You can install Cowboy extension in 2 ways.

### Install from extensions web page

Open in firefox https://extensions.gnome.org/extension/753/cowboy and enable the extension.

### Clone from github

```
git clone https://github.com/kazjote/cowboy.git

mddir -p $HOME/.local/share/gnome-shell/extensions

ln -s `pwd`/cowboy $HOME/.local/share/gnome-shell/extensions/cowboy@kazjote.eu
```

## Development

You can use cowboy\_release script to prepare zip package that can be submitted to extensions.gnome.org.
