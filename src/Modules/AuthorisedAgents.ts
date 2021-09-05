'use strict';

// To Do: Handle `some`?
// To Do: Handle groups?

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';
import { nanoid as nanoidSync } from 'nanoid';
import { nanoid } from 'nanoid/async';
import { run as rethinkRun } from '@chris-talman/rethink-utilities';

// Internal Modules
import { PermissionSystem } from 'src/Modules';

// Types
import { RDatum } from 'rethinkdb-ts';
import { Permission, PermissionTargetEntity } from 'src/Modules';
export interface PermissionParameters <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> extends Array <PermissionParameter <GenericPermissionType, GenericSubjectTargetEntityType>> {};
export interface PermissionParameter <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
{
	type: GenericPermissionType;
	subject?: PermissionTargetEntity <GenericSubjectTargetEntityType>;
	/**
		At least one permission must be authorised, but not necessarily this one.
		Can be grouped by a `string`, requiring one permission with that `string` to be authorised.
	*/
	some?: boolean | string;
};
interface PermissionEvaluations extends Array <PermissionEvaluation> {};
interface PermissionEvaluation
{
	document: Permission <any>;
	parameter: PermissionParameter <any, any>;
};

// Constants
import
{
	SPECIAL_ID_ALL,
	NOT_DELETED
} from 'src/Modules/Constants';

/** Gets agents authorised for one or more of the given permission types, and, if provided, for the given subject. */
export async function getAuthorisedAgents <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, permissions: rawPermissions}: {domainId: string, permissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>}
)
{
	const permissions = await generatePermissionsWithGroupsAsync({rawPermissions, system: this});
	const query = generateQuery({domainId, permissions, system: this});
	const agents = await rethinkRun({query, options: {throwRuntime: false}});
	return agents;
};

export function generateGetAuthorisedAgentsQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string, GenericPermissions extends PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>>
(
	this: PermissionSystem <any, any, any, any>,
	{domainId, permissions: rawPermissions}: {domainId: string | RDatum <string>, permissions: GenericPermissions}
)
{
	const permissions = generatePermissionsWithGroupsSync({rawPermissions, system: this});
	const query = generateQuery({domainId, permissions, system: this});
	return query;
};

async function generatePermissionsWithGroupsAsync <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({rawPermissions, system}: {rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const someGroup = await nanoid(10);
	const permissions = generatePermissionsWithGroups({someGroup, rawPermissions, system});
	return permissions;
};

function generatePermissionsWithGroupsSync <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({rawPermissions, system}: {rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const someGroup = nanoidSync(10);
	const permissions = generatePermissionsWithGroups({someGroup, rawPermissions, system});
	return permissions;
};

function generatePermissionsWithGroups <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string> ({someGroup, rawPermissions, system}: {someGroup: string, rawPermissions: PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>, system: PermissionSystem <any, any, any, any>})
{
	const permissions: typeof rawPermissions = [];
	for (let rawPermission of rawPermissions)
	{
		permissions.push(rawPermission);
		const groupPermissionTypes = new Set <GenericPermissionType> ();
		if (system.groupPermissions)
		{
			for (let [ groupPermissionType, groupPermissionMemberTypes ] of Object.entries(system.groupPermissions))
			{
				for (let groupPermissionMemberType of groupPermissionMemberTypes as Array <GenericPermissionType>)
				{
					if (rawPermission.type === groupPermissionMemberType)
					{
						groupPermissionTypes.add(groupPermissionType as GenericPermissionType);
					};
				};
			};
		};
		for (let groupPermissionType of groupPermissionTypes)
		{
			const some = rawPermission.some === true ? true : someGroup;
			rawPermission.some = some;
			const permission = Object.assign({}, rawPermission);
			permission.some = some;
			permission.type = groupPermissionType;
			permissions.push(permission);
		};
	};
	return permissions;
};

function generateQuery <GenericPermissionType extends string, GenericSubjectTargetEntityType extends string, GenericPermissions extends PermissionParameters <GenericPermissionType, GenericSubjectTargetEntityType>>
(
	{domainId, permissions, system}: {domainId: string | RDatum <string>, permissions: GenericPermissions, system: PermissionSystem <any, any, any, any>}
)
{
	const query = RethinkDB
		.union
		(
			// @ts-ignore
			... permissions.map
			(
				permission =>
				(
					permission.subject
					?
						RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								[
									domainId,
									permission.type,
									permission.subject.id,
									permission.subject.type,
									false
								],
								[
									domainId,
									permission.type,
									SPECIAL_ID_ALL,
									permission.subject.type,
									false
								],
								{ index: system.indexes.subjectPermission }
							)
					:
						RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								[
									domainId,
									permission.type,
									NOT_DELETED
								],
								{
									index: system.indexes.simplePermission
								}
							)
				)
				.map
				(
					databasePermission =>
					(
						{
							document: databasePermission,
							parameter: permission
						}
					)
				)
			)
		)
		.coerceTo('array')
		.do
		(
			(
				(permissions: RDatum <PermissionEvaluations>) => permissions
					.filter
					(
						permission => RethinkDB.and
						(
							permission('document')('negated').default(false).eq(false),
							permissions
								.filter
								(
									otherPermission => RethinkDB.and
									(
										RethinkDB.or
										(
											RethinkDB.and
											(
												permission('parameter').hasFields('subject'),
												otherPermission('parameter').hasFields('subject'),
												otherPermission('parameter')('subject')('id').eq(permission('parameter')('id')),
												otherPermission('parameter')('subject')('type').eq(permission('parameter')('type'))
											),
											permission('parameter').hasFields('subject').eq(false)
										),
										otherPermission('document')('negated').default(false).eq(true)
									)
								)
								.count()
								.eq(0)
						)
					)
					.map
					(
						permission => permission('document')('agent')
					)
			) as any
		)
		.union
		(
			system.queries.getGlobalAuthorisedAgents?.({domainId}) ?? [] as any,
			system.queries.getOrganisationAuthorisedAgents?.({domainId}) ?? [] as any,
			system.globalPermissions
			?
					RethinkDB
						.table<Permission <any>>(system.table)
						.getAll
						(
							... system.globalPermissions.reduce
							(
								(keys, permission) =>
								{
									if ('range' in permission)
									{
										for (let type of permission.range.types)
										{
											keys.push
											(
												[
													domainId,
													type,
													NOT_DELETED
												]
											);
										};
									};
									return keys;
								},
								[] as Array <any>
							),
							{ index: system.indexes.simplePermission }
						)
						.coerceTo('array')
						('agent')
			:
				[]
		);
	return query;
};