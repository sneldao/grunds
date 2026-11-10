set -e
V=capture/video
W=work; mkdir -p $W dist
enc() { ffmpeg -y -v error "$@"; }

seg() { # in start dur cap out
  local f=$1 s=$2 d=$3 cap=$4 o=$5
  enc -ss $s -i $V/$f -t $d -an -vf "fps=30,format=yuv420p,setsar=1" -c:v libx264 -crf 18 $W/$o
  if [ -n "$cap" ]; then
    enc -i $W/$o -i capture/$cap -filter_complex "overlay=0:0" -c:v libx264 -crf 18 $W/${o%.mp4}-cap.mp4
    mv $W/${o%.mp4}-cap.mp4 $W/$o
  fi
}

seg page@bfc7549ddb415325943248913b6d3815.webm 19.5 3.0 ''              s0-title.mp4
seg page@d013ae12f1214de0970b4fa589dd0975.webm 16.0 6.5 cap-street.png   s2-street.mp4
seg page@513390755ec7108bb865d7418396c6e6.webm 19.0 6.0 cap-commute.png s1-commute.mp4
seg page@bfc7549ddb415325943248913b6d3815.webm 26.0 5.0 ''              s4-brief.mp4
seg page@6470510b44cbc2da04080fcb5f11caab.webm 57.0 6.0 cap-rush.png    s3-rush.mp4
seg page@6f4bdffef0e845596d8c7c454b3abcbf.webm 25.5 5.3 cap-city.png    s5-city.mp4
seg page@483d258eee1ff5102e39d97062ca6011.webm 50.0 3.5 cap-dusk.png    s6-evening.mp4

enc -loop 1 -t 5.0 -i capture/card-cta.png -vf "fps=30,format=yuv420p,setsar=1" -c:v libx264 -crf 18 $W/c2.mp4

cat > $W/list.txt <<L
file 's0-title.mp4'
file 's2-street.mp4'
file 's1-commute.mp4'
file 's4-brief.mp4'
file 's3-rush.mp4'
file 's5-city.mp4'
file 's6-evening.mp4'
file 'c2.mp4'
L
enc -f concat -safe 0 -i $W/list.txt -c copy $W/video.mp4

enc -i $W/video.mp4 -i ../city-remix/capture/audio/bed.wav \
  -filter_complex "[1:a]volume=0.32,afade=t=in:st=0:d=1.2,afade=t=out:st=37:d=3.5[a]" \
  -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 160k -shortest dist/grunds-loadout.mp4

ffprobe -v error -show_entries format=duration,size dist/grunds-loadout.mp4 | head -4
