import os, sys
import re
from argparse import ArgumentParser


def build(out_fname=None, **keywords):
	ls = os.listdir()
	template_filename = 'template.user.js' 
	if template_filename not in ls:
		raise ValueError('{} not found'.format(template_filename))
	with open(template_filename, "r") as f:
		text = f.read()
	varnames = re.findall(r'%\w+', text)
	for name in varnames:
		fname = "{}.js".format(name[1:])
		if fname not in ls:
			raise ValueError('{} not found'.format(fname))
		with open(fname, "r") as in_file:
			in_text = in_file.read()
			in_text, _ = re.subn(r'\\', r'\\\\', in_text)
		text, _ = re.subn(name, in_text, text)
	
	with open(out_fname, "w") as out_file:
		out_file.write(text);


if __name__ == "__main__":
	parser = ArgumentParser(description="simple build script")
	parser.add_argument(
		"-o", dest="out_fname", type=str, default="sections.user.js",
		help="output filename, f.i. {installdir}/{filename}"
	)
	parser.add_argument(
		"--debug", dest="debug", action='store_const',
		default=False, const=True,
		help="output filename, f.i. {installdir}/{filename}"
	)
	args = vars(parser.parse_args())
	debug = args.pop("debug")
	# if debug:
		# try: build(**args)
		# except:
			# import
	build(**args)
