import { appwriteInit } from '../(utils)/appwrite';
import { type AppwriteUser } from '$lib/utils/console';
import { appwriteInitServer } from './appwrite.server';
import { PUBLIC_APPWRITE_PROJECT_INIT_ID } from '$env/static/public';
import type { Cookies } from '@sveltejs/kit';

export const createInitSession = async (userId: string, secret: string, cookies: Cookies) => {
    if (!userId || !secret) {
        return {
            data: null
        };
    }

    try {
        const session = await appwriteInitServer.account.createSession(userId, secret);

        cookies.set(`a_session_${PUBLIC_APPWRITE_PROJECT_INIT_ID}`, session.secret, {
            path: '/',
            httpOnly: true,
            secure: true
        });

        const cookieFallback = {
            [`a_session_${PUBLIC_APPWRITE_PROJECT_INIT_ID}`]: session.secret
        };

        return { cookieFallback };
    } catch (e) {
        console.error(e);
        return new Response(
            JSON.stringify({
                data: null
            }),
            {
                status: 403,
                headers: {
                    'content-type': 'application/json'
                }
            }
        );
    }
};

export interface GithubUser {
    login: string;
    name: string;
    email: string;
}

export const getGithubUser = async () => {
    try {
        const identitiesList = await appwriteInit.account.listIdentities();
        if (!identitiesList.total) return null;
        const identity = identitiesList.identities[0];
        const { providerAccessToken, provider } = identity;
        if (provider !== 'github') return null;

        const res = await fetch('https://api.github.com/user', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${providerAccessToken}`
            }
        })
            .then((res) => {
                return res.json() as Promise<GithubUser>;
            })
            .then((n) => ({
                login: n.login,
                name: n.name,
                email: n.email
            }));

        if (!res.login) {
            await appwriteInit.account.deleteSession('current');
            return null;
        }

        return res;
    } catch (e) {
        console.error(e);
        return null;
    }
};

export async function getAppwriteUser(): Promise<AppwriteUser | null> {
    return await appwriteInit.account
        .get()
        .then((res) => res)
        .catch(() => null);
}

export type User = {
    github: GithubUser | null;
    appwrite: AppwriteUser | null;
};

export const getInitUser = async () => {
    const [github, appwrite] = await Promise.all([getGithubUser(), getAppwriteUser()]);

    return { github, appwrite };
};

export const isLoggedIn = async () => {
    const user = await getInitUser();

    return !!user.github;
};
