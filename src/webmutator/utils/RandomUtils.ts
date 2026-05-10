
export class RandomUtils {
    static getRandomString(length: number): string {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    }

    static getMutantString(original: string): string {
        return original + "_mutant";
    }

    static getRandomHexString(length: number): string {
        let result = '';
        const characters = '0123456789ABCDEF';
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * 16));
        }
        return result;
    }

    static getRandomCoordinates(maxX: number = 500, maxY: number = 500): { x: number, y: number } {
        return {
            x: Math.floor(Math.random() * maxX),
            y: Math.floor(Math.random() * maxY)
        };
    }

    static getRandomToken(tokens: Set<string> | string[]): string | null {
        const arr = Array.from(tokens);
        if (arr.length === 0) return null;
        return arr[Math.floor(Math.random() * arr.length)];
    }
}
