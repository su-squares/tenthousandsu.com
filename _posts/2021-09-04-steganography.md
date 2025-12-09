---
layout: article
permalink: /articles/2021-09-04-steganography
title: Storing text/data in your square
image: "{{ site.baseurl }}/assets/images/su-OG.png"
description: "Guides readers through converting messages into 10A-10 pixel images for hiding and revealing data on their Squares."
---

# Storing text/data in your square 

*If you have a question, please mail [Su@TenThousandSu.com](mailto:Su@TenThousandSu.com?subject=Su Squares&body=Hi Su%2C Please help! I have a question about Su Squares. ).*

Your Square fits 10×10=100 pixels with three color channels at 8 bits each. That means you get 300 bytes to play with.

Typically you are putting visual stuff in there to make something pretty. But if you are a Soviet era spy, you might want to use this as an inconspicuous and very public way of disseminating subversion messages. This is a guide for those people...

All subversives use Linux or macOS, and the command line. So this guide assumes you are familiar with both of these. On macOS, please install [Homebrew](https://brew.sh) and run `brew install imagemagick`. For Linux you should probably already have ImageMagick installed and instructions vary to get it.

## Convert a tweet-sized poem into a 10×10 pixel PNG file

You have 300 bytes to work with. As of 2021, that includes anything you can tweet.

> The secret meetup location is at the seventh stairway at seven.

Let's put that into a file:

```sh
echo 'The secret meetup location is at the seventh stairway at seven.' > message.txt
```

We need to get that to a 300-byte file, so let's make a canvas and paste that in there:

```sh
dd if=/dev/zero bs=1 count=300 > square.rgb
dd if=message.txt of=square.rgb conv=notrunc
```

And now make it into a PNG image (which is a lossless format) using the input as raw RGB values:

```sh
convert -size 10x10 -depth 8 rgb:square.rgb square.png
```

Now [go personalize your Su Square](/personalize) with that 10×10 image!

## Extract a secret message from a 10×10 pixel PNG file

First, get the PNG file into a usable rgb data format:

```sh
convert square.png out.rgb
```

From this point, you could open that file in your text editor, using `hexdump` or similar tools. But luckily there is a simple way to extract strings from a binary file:

```sh
strings square.rgb
```

Output:

> The secret meetup location is at the seventh stairway at seven.

## Why so black

Your Square is black, and there's nothing wrong with that.

But we can use this same process to put a secret message in a colorful picture by only mangling the beginning of it.

Let's get some 10×10 image as a starting point. How about the Su Squares website favicon resized to 10×10?

```sh
curl https://tenthousandsu.com/favicon.ico | convert -resize 10x10\! ico:- fav.png
```

Now, splice the hidden message into there using the same technique:

```sh
convert fav.png fav.rgb
dd if=message.txt of=fav.rgb conv=notrunc
convert -size 10x10 -depth 8 rgb:fav.rgb fav-with-secret.png
```

And of course, get it with:

```
strings fav.rgb
```

## Are there any hidden messages in Su Squares?

:warning: Warning, these commands will make 10,000 files on your current directory. You might want to do this inside a folder.

Let's find out! First, download the main image with all the Squares.

```sh
wget https://tenthousandsu.com/build/wholeSquare.webp
```

Use one command to split that out into 10,000 constituent images:

```sh
convert wholeSquare.webp -crop 10x10 square.png
```

:information_source: Note that ImageMagick starts numbering at zero, so the image square-0.png corresponds to Su Square 1.

Convert all the PNG files to RGB files:

```sh
mogrify -format rgb square-*.png
```

And look for hidden messages:

```sh
strings square-*.rgb
```

## Homework

1. Using the above techniques, splice a message into your current Su Square.
2. Using the above techniques, with modification, splice a message into the the end of an image.
3. Create a 10×10 PNG image that includes a web page that generates a random maze, see https://x.com/botond_balazs/status/637960240055615488.
4. Golf that JavaScript better than @fulldecent golfed it.
