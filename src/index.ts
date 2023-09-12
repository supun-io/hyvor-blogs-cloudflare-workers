import { Blog } from "@hyvor/hyvor-blogs-serve-web";

export interface Env {
	BASE_PATH: string,
	SUBDOMAIN: string,
	DELIVERY_API_KEY: string,
	WEBHOOK_SECRET: string,
	BLOG_CACHE: KVNamespace,
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {

		const configError = validateConfig(env);
		if (configError) {
			return errorResponse(configError)
		}

		const url = new URL(request.url);
		const path = url.pathname;
		const blogPath = path.replace(env.BASE_PATH, '');
		const blog = getBlog(env);

		if (request.method === 'POST') {
			if (blogPath === '/_hb_webhook') {
				const json = await request.json();
				return await blog.handleWebhookRequest(json, env.WEBHOOK_SECRET);
			} else {
				return notFoundResponse();
			}
		}

		if (blogPath === '/_cache_health') {
			return await cacheHealthResponse(env);
		}

		return await blog.handleBlogRequest(blogPath);
	},
};

function validateConfig(env: Env) {
	if (!env.SUBDOMAIN) {
		return 'SUBDOMAIN is not set';
	}
	if (!env.DELIVERY_API_KEY) {
		return 'DELIVERY_API_KEY is not set';
	}
	if (!env.BLOG_CACHE) {
		return 'BLOG_CACHE is not set';
	}
	return null;
}

function notFoundResponse() {
	return new Response('Not found', { status: 404 });
}

function errorResponse(message: string) {
	return new Response(message, { status: 500 });
}

function getBlog(env: Env) {

	return new Blog({
        subdomain: env.SUBDOMAIN,
        deliveryApiKey: env.DELIVERY_API_KEY,
        webhookSecret: env.WEBHOOK_SECRET,

		cache: getCache(env.BLOG_CACHE)
	});

}

function getCache(namespace: KVNamespace) {
	return {
		get: async (key: string) => {
			const val = await namespace.get(key);
			if (!val) return null;

			try {
				return JSON.parse(val);
			} catch (e) {
				return null;
			}
		},
		set: async (key: string, value: string) => {
			await namespace.put(key, JSON.stringify(value));
		},
		delete: async (key: string) => {
			await namespace.delete(key);
		}
	}
}

async function cacheHealthResponse(env: Env) {
	const cache = getCache(env.BLOG_CACHE);
	const random = Math.random().toString(36).substring(7);
	await cache.set('test', random);
	const val = await cache.get('test');
	return new Response(val === random ? 'Healthy ✅' : 'Unhealthy ⚠️', { status: 200 });
}