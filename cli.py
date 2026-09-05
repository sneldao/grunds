#!/usr/bin/env python3
"""Grunds CLI entry point."""
import argparse

def main():
    parser = argparse.ArgumentParser(prog="grunds", description="Grunds — The District: a live 3D coffee economy")
    sub = parser.add_subparsers(dest="command")
    sub.add_parser("run", help="Parse CSV and emit the wave schedule")
    sub.add_parser("spatial", help="Launch the Three.js floor at localhost:8787")
    sub.add_parser("eval", help="Score the demo loop (WIP)")
    args = parser.parse_args()
    if not args.command:
        parser.print_help()
    elif args.command == "run":
        from grunds import ingest

        ingest.main()
    elif args.command == "spatial":
        from grunds import spatial

        spatial.main()
    else:
        print("eval: demo-loop scoring not wired yet (see EVAL.md)")

if __name__ == "__main__":
    main()
