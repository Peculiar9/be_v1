import type { Context } from "hono";
import { controller, httpGet, ctx } from "hono-injector";
import { UtilityService } from "@Core/Services/UtilityService";
import { API_DOC_URL, APP_NAME, APP_VERSION } from "@Core/Types/Constants";
import { BaseController } from "./BaseController";
import { ResponseMessage } from "@Core/Application/Response/ResponseFormat";

@controller(`/`)
export class InitController extends BaseController {
    constructor() {
        super();
    }

    @httpGet('')
    async baseMethod(@ctx() c: Context) {
        const baseRequestPayload = this.constructBaseRouterPayload();
        return this.success(c, baseRequestPayload, ResponseMessage.SUCCESSFUL_REQUEST_MESSAGE);
    }

    // Health check moved to HealthController


    private constructBaseRouterPayload() {
        const reqTime = Date.now();
        const reqTimeUnix = UtilityService.dateToUnix(reqTime);
        const baseUrlPayload: IBaseUrlPayload =
        {
            api_info: {
                name: `${APP_NAME} Backend Service`,
                version: APP_VERSION,
                description: `API for managing ${APP_NAME} functionalities and requests`,
                documentation: `https://postman.docs/${API_DOC_URL}`
            },
            authentication: "This API needs AccessKeys and JWT to gain access",
            scopes: [],
            request_time: reqTimeUnix
        }

        return baseUrlPayload;
    }

}


interface IBaseUrlPayload {
    api_info: IApiInfo;
    authentication: string;
    scopes: [];
    request_time: number
}
interface IApiInfo {
    name: string;
    version: string
    description: string;
    documentation: string;
}
