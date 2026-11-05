import { app } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";

const account = process.env.STORAGE_ACCOUNT_NAME;
const sas = process.env.STORAGE_ACCOUNT_SAS_URL;
const containerName = process.env.LOG_CONTAINER;

if (!account || !sas || !containerName) {
	throw new Error("Missing Azure Storage environment variables");
}

const blobServiceClient = new BlobServiceClient(
	`https://${account}.blob.core.windows.net/?${sas}`,
);

const containerClient = blobServiceClient.getContainerClient(containerName);

async function uploadJsonBlob(blobName, data) {
	const blockBlobClient = containerClient.getBlockBlobClient(blobName);
	const json = JSON.stringify(data);

	await blockBlobClient.upload(json, Buffer.byteLength(json), {
		blobHTTPHeaders: { blobContentType: "application/json" },
	});

	return blockBlobClient.url;
}

const getBlobAsJson = async (client, context) => {
	try {
		const exists = await client.exists();
		if (!exists) {
			context.log(`Blob does not exist: ${client.name}`);
			return [];
		}

		const content = await client.download();
		const contentString = await streamToString(content.readableStreamBody);

		return JSON.parse(contentString.replace(/^\uFEFF/, ""));
	} catch (err) {
		context.log(`Failed to read blob: ${client.name}`, err);
		return [];
	}
};

const streamToString = async (stream) => {
	if (!stream) throw new Error("Stream is undefined");

	const chunks = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf-8");
};

const handleDate = (date) => {
	if (!date) return null;

	let converted = new Date(date);

	return typeof value !== "object" || value instanceof Date === false
		? converted
		: null;
};

const trunc = (value, max) => String(value ?? "").substring(0, max);

const handleResp = (name) => {
	let lowercaseName = String(name).toLowerCase();

	switch (lowercaseName) {
		case "nick sacco":
			return 11;
		case "joe tardif":
			return 13;
		case "eugenio carpinito":
			return 17;
		case "mitch lamarre":
			return 23;
		case "steve francis":
			return 25;
		case "bill esson":
			return 32;
		case "sam greenip":
			return 33;
		case "dean moran":
			return 35;
		case "greg grafton":
			return 38;
		case "tim smith":
			return 39;
		case "matt mallahan":
			return 41;
		default:
			return null;
	}
};

const handleScope = (scope, vendor) => {
	const immutableScopes = new Set(
		"misc equipment",
		"residential shades",
		"toilet accessories",
		"residential vdb",
		"wall protection",
		"wall pro",
	);
	const formattedScope = immutableScopes.has(scope.toLowerCase());
};

app.http("JobTrackerSyncTimer", {
	methods: ["GET"],
	authLevel: "anonymous",
	handler: async (request, context) => {
		try {
			const baseClient = containerClient.getBlockBlobClient(
				"staging/job-tracking-raw.json",
			);

			const rawJobData = (
				await getBlobAsJson(baseClient, context)
			).filter((r) => r["Job Name"] && r["Scope"]);

			const cleanedJobData = rawJobData.map((jobData, seq) => {
				const {
					Company,
					"ACK Date": ACKDate,
					"ACK Number": ACKNum,
					Contract,
					Customer,
					"Date Approved": DateApproved,
					"Date Needed": DateNeeded,
					"Date Released": DateReleased,
					"Date Submitted": DateSubmitted,
					"Days Until Order By": DaysUntilOrderBy,
					Deposit,
					"Due By": DueBy,
					"F&I / FOB": FIFOB,
					Items,
					Division: JCDept,
					"Job Number": Job,
					"Job Name": JobName,
					GC,
					"Lead Time (weeks)": LeadTime,
					Notes: NotesTop,
					"Order By": OrderBy,
					Overdue,
					"Quote Exp Date": QED,
					Resp,
					Scope,
					Status,
					"Tracking Number": TrackingNumber,
					Urgency,
					Urgent,
					"Vendor/Manufacturer": VendManu,
					"Vendor Acknowledgement": VendorAcknowledgement,
					"Vendor Ship Date": VendorShipDate,
					Watch,
					"Contract $": ContractAmt,
				} = jobData;

				return {
					Co: 23,
					ACKDate: handleDate(ACKDate),
					ACKNum: trunc(ACKNum, 20),
					Contract: Contract ?? null,
					Customer: Customer ?? "",
					DateApproved: handleDate(DateApproved),
					DateNeeded: handleDate(DateNeeded),
					DateReleased: handleDate(DateReleased),
					DateSubmitted: handleDate(DateSubmitted),
					DaysUntilOrderBy,
					Deposit,
					DueBy: handleDate(DueBy),
					FIFOB,
					Items,
					JCDept,
					Job,
					JobName: trunc(JobName, 30),
					LeadTime,
					NotesTop,
					OrderBy: handleDate(OrderBy),
					Overdue,
					QuoteExpRate: handleDate(QED),
					Resp: handleResp(Resp),
					Scope,
					Status: trunc(Status, 1000),
					TrackingNumber,
					Urgency: Urgency ?? "-",
					Urgent,
					Vendor: VendManu,
					VendorAcknowledgement,
					VendorShipDate,
                    Watch,
                    Seq: seq
				};
			});

			const cleanedJsonLocation = `cleaned/job-tracking-${new Date().toISOString().slice(0, 10)}.json`;
			await uploadJsonBlob(cleanedJsonLocation, cleanedJobData);
			context.log(
				`Cleaned ${cleanedJobData.length} rows -> ${cleanedJsonLocation}`,
			);

			return {
				status: 200,
				jsonBody: {
					count: cleanedJobData.length,
					fileName: cleanedJsonLocation,
				},
			};
		} catch (err) {
			context.error("JobTrackerSyncTimer failed", err);
			return { status: 500, body: String(err) };
		}
	},
});
