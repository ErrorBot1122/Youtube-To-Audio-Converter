{ pkgs }: {
	deps = [
		pkgs.zip
		pkgs.unzip
		pkgs.sudo
		pkgs.lsof
		pkgs.ffmpeg.bin
		pkgs.youtube-dl-light
		pkgs.python39Full
		pkgs.nodejs-16_x
        pkgs.nodePackages.typescript-language-server
        pkgs.nodePackages.yarn
        pkgs.replitPackages.jest
	];
}