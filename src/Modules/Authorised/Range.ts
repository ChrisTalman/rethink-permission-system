'use strict';

// External Modules
import { r as RethinkDB } from 'rethinkdb-ts';

// Types
import { RDatum } from 'rethinkdb-ts';
import { PermissionSystem, Permission, UserRoles } from 'src/Modules';
import { PermissionParameterEvaluation } from './';

// Constants
const NEGATED = true;
const NOT_NEGATED = false;
const NOT_DELETED = false;

export function generateUserAuthorisedByRangeQuery <GenericPermissionTypes extends Array<string>, GenericTargetEntityType extends string>
({domainId, userRoles, permissions, system}: {domainId: string, userRoles: RDatum <UserRoles <GenericTargetEntityType>>, permissions: GenericPermissionTypes, system: PermissionSystem <any, any, any, any>})
{
	const query: RDatum <PermissionParameterEvaluation> = RethinkDB
		.expr
		(
			{
				granted: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									permissions.map
									(
										permissionType => [ domainId, permissionType, NOT_NEGATED, role('id'), role('type'), NOT_DELETED ]
									)
								),
								{ index: system.indexes.range }
							)
					)
					.count()
					.gt(0),
				negated: userRoles
					.concatMap
					(
						role => RethinkDB
							.table<Permission <any>>(system.table)
							.getAll
							(
								RethinkDB.args
								(
									permissions.map
									(
										permissionType => [ domainId, permissionType, NEGATED, role('id'), role('type'), NOT_DELETED ]
									)
								),
								{ index: system.indexes.range }
							)
					)
					.group('type')
					.ungroup()
					.count()
					.lt(permissions.length)
			}
		)
		.merge
		(
			(evaluations: RDatum<PermissionParameterEvaluation>) =>
			(
				{
					authorised: RethinkDB.and
					(
						evaluations('granted').eq(true),
						evaluations('negated').eq(false)
					)
				}
			)
		);
	return query;
};