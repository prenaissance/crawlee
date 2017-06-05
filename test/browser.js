import { expect } from 'chai';
import CDP from 'chrome-remote-interface';
import { getDefaultBrowseOptions, launchChrome } from '../build/browser';
import Apifier from '../build/index';


describe('getDefaultBrowseOptions()', () => {
    it('it works', () => {
        process.env.APIFY_HEADLESS = '1';
        const opts1 = getDefaultBrowseOptions();
        expect(opts1).to.eql({
            browser: 'chrome',
            headless: true,
        });

        delete process.env.APIFY_HEADLESS;
        const opts2 = getDefaultBrowseOptions();
        expect(opts2).to.eql({
            browser: 'chrome',
            headless: false,
        });
    });
});


describe('Apifier.browse()', () => {
    it('opens about:blank with no args', () => {
        process.env.APIFY_HEADLESS = '1';
        let browser;
        return Apifier.browse()
            .then((res) => {
                browser = res;
                expect(browser.constructor.name).to.eql('Browser');
                return browser.webDriver.getCurrentUrl();
            })
            .then((url) => {
                expect(url).to.eql('about:blank');
                return browser.close();
            });
    }).timeout(10000);

    it('opens https://www.example.com in headless mode', () => {
        delete process.env.APIFY_HEADLESS;
        let browser;
        return Apifier.browse('https://www.example.com', { headless: true })
        .then((res) => {
            browser = res;
            expect(browser.constructor.name).to.eql('Browser');
            return browser.webDriver.getCurrentUrl();
        })
        .then((url) => {
            expect(url).to.eql('https://www.example.com/');
            return browser.close();
        });
    }).timeout(10000);
});


describe('launchChrome()', () => {
    let launcher;

    before(() => {
        process.env.APIFY_HEADLESS = '1';
        return launchChrome().then((l) => {
            launcher = l;
        });
    });

    it('reports head-less version', () => {
        return Promise.resolve().then(() => {
            return CDP.Version();
        })
        .then((version) => {
            expect(version.Browser).to.contain('HeadlessChrome');
            // console.dir(version);
        });
    });

    it('opens http://www.example.com', () => {
        function onPageLoad(Runtime) {
            const js = 'document.querySelector("title").textContent';

            // Evaluate the JS expression in the page.
            return Runtime.evaluate({ expression: js })
                .then((result) => {
                    console.log(`Title of page: ${result.result.value}`);
                });
        }

        return new Promise((resolve, reject) => {
            CDP((protocol) => {
                // Extract the parts of the DevTools protocol we need for the task.
                // See API docs: https://chromedevtools.github.io/devtools-protocol/
                const { Page, Runtime } = protocol;

                // First, need to enable the domains we're going to use.
                Promise.all([
                    Page.enable(),
                    Runtime.enable(),
                ])
                .then(() => {
                    Page.navigate({ url: 'https://www.example.com/' });

                    // Wait for window.onload before doing stuff.
                    Page.loadEventFired(() => {
                        onPageLoad(Runtime)
                        .then(() => {
                            protocol.close();
                            resolve();
                        });
                    });
                });
            })
            .on('error', reject);
        });
    }).timeout(10000);

    // it('test github requests', () => {
    //     return new Promise((resolve, reject) => {
    //         CDP((client) => {
    //             // extract domains
    //             const { Network, Page } = client;
    //             // setup handlers
    //             Network.requestWillBeSent((params) => {
    //                 console.log(params.request.url);
    //             });
    //             Page.loadEventFired(() => {
    //                 client.close();
    //             });
    //             // enable events then start!
    //             Promise.all([
    //                 Network.enable(),
    //                 Page.enable(),
    //             ]).then(() => {
    //                 return Page.navigate({ url: 'https://github.com' });
    //             }).catch((err) => {
    //                 console.error(err);
    //                 client.close();
    //                 resolve();
    //             });
    //         }).on('error', (err) => {
    //             // cannot connect to the remote endpoint
    //             console.error(err);
    //             reject(err);
    //         });
    //     });
    // });

    after(() => {
        return launcher.kill();
    });
});
