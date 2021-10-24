const path = require("path");
const vm = require("vm");
const fs = require("fs");

function MyModule(id = "") {
	this.id = id;
	this.path = path.dirname(id);
	this.export = {};
	this.filename = null;
	this.loaded = false;
}

MyModule.prototype.require = function (id) {
	return MyModule._load(id);
};

MyModule._cache = Object.create(null);
MyModule._extensions = Object.create(null);

MyModule._load = function (request) {
	const filename = MyModule._resolveFilename(request);

	// 如果模块已经加载过则直接从缓存获取
	const cachedModule = MyModule._cache[filename];
	if (cachedModule !== undefined) {
		return cacheModule.exports;
	}

	const module = new MyModule(filename);
	MyModule._cache[filename] = module;
	module.load(filename);
	return module.exports;
};

// 简易版本 只支持相对路径和绝对路径
MyModule._resolveFilename = function (request) {
	const filename = path.resolve(request);
	const extname = path.extname(request);

	if (!extname) {
		const exts = Object.keys(MyModule._extensions);
		for (let i = 0; i < exts.length; i++) {
			const currentPath = `${filename}${extname}`;

			if (fs.existsSync(currentPath)) {
				return currentPath;
			}
		}
	}

	return filename;
};

MyModule.prototype.load = function (filename) {
	const extname = path.extname(filename);
	MyModule._extensions[extname](this, filename);
	this.loaded = true;
};

MyModule._extensions[".js"] = function (module, filename) {
	const content = fs.readFileSync(filename, "utf8");
	module._compile(content, filename);
};

MyModule._extensions[".json"] = function (module, filename) {
	const content = fs.readFileSync(filename, "utf8");
	module.exports = JSONParse(content);
};

MyModule._compile = function (content, filename) {
	const wrapper = MyModule.wrap(content);

	// vm是nodejs的虚拟机沙盒模块，runInThisContext方法可以接受一个字符串并将它转化为一个函数
	// 返回值就是转化后的函数，所以compiledWrapper是一个函数
	const compiledWrapper = vm.runInThisContext(wrapper, {
		filename,
		lineOffset: 0,
		displayErrors: true,
	});

	// 准备exports, require, module, __filename, __dirname这几个参数
	// exports可以直接用module.exports，即this.exports
	// require官方源码中还包装了一层，其实最后调用的还是this.require
	// module不用说，就是this了
	// __filename直接用传进来的filename参数了
	// __dirname需要通过filename获取下
	const dirname = path.dirname(filename);
	compiledWrapper.call(
		this.exports,
		this.exports,
		this.require,
		this,
		filename,
		dirname
	);
};

MyModule.wrapper = [
	"(function (exports, require, module, __filename, __dirname) { ",
	"\n});",
];

MyModule.wrap = function (script) {
	return MyModule.wrapper[0] + script + MyModule.wrapper[1];
};
